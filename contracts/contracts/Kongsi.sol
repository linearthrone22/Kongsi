// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Kongsi - Milestone-based Revenue Sharing Token (MVP hackathon)
/// @notice Setiap proyek = 1 "effort" (mis. panen 1000 bibit padi) yang ditokenisasi.
///  - Dana investor dikunci di escrow dan dicairkan bertahap per milestone.
///  - Milestone sah jika >50% token memverifikasi bukti yang diunggah pengusaha.
///  - Jika >50% token menolak (atau pengusaha membatalkan / pendanaan gagal),
///    sisa escrow dibuka untuk refund proporsional.
///  - Setelah semua milestone selesai, pengusaha menyetor hasil dan dibagi per token (maks. maxYield).
///  - Secondary market: listing harga tetap antar investor, setelah minimal 1 milestone terverifikasi.
/// Mata uang: native coin (ETH). Token = akuntansi internal per proyek (bukan ERC-20) untuk MVP.
contract Kongsi {
    // ───────────────────────────── Types ─────────────────────────────
    enum ProjectStatus { Fundraising, Active, Completed, Failed }
    enum MilestoneStatus { Pending, UnderReview, Verified, Rejected }

    struct Milestone {
        string title;
        uint16 bps; // porsi pencairan dari total dana terkumpul (basis points, total 10_000)
        string evidenceURI; // dokumen/bukti terakhir yang diunggah pengusaha
        MilestoneStatus status;
    }

    struct Project {
        address farmer;
        string title;
        string metadataURI; // profil/portfolio/spesifikasi (off-chain, mis. IPFS)
        uint256 tokenPrice; // harga primer per token (wei)
        uint256 totalTokens; // target jumlah token yang dijual
        uint256 sold; // token terjual
        uint256 fundingDeadline;
        uint256 maxYield; // total maksimum yang dijanjikan ke investor (wei)
        uint256 raised; // sold * tokenPrice
        uint256 escrow; // dana yang belum dicairkan
        uint256 released; // dana yang sudah dicairkan ke pengusaha
        uint256 currentMilestone; // index milestone aktif
        uint256 round; // ronde voting (naik tiap bukti baru)
        uint256 approveWeight;
        uint256 rejectWeight;
        ProjectStatus status;
        // refund
        uint256 refundPool;
        uint256 refundTokens;
        // revenue sharing
        uint256 revenueDeposited;
        uint256 accRevenuePerToken; // scaled 1e18
    }

    struct Listing {
        uint256 projectId;
        address seller;
        uint256 amount; // token tersisa
        uint256 pricePerToken; // wei
        bool active;
    }

    uint256 private constant ACC = 1e18;

    // ───────────────────────────── Storage ─────────────────────────────
    uint256 public projectCount;
    uint256 public listingCount;

    mapping(uint256 => Project) private projects;
    mapping(uint256 => Milestone[]) private milestones;
    mapping(uint256 => mapping(address => uint256)) public balanceOf; // projectId => holder => token
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVoted; // id => round => user
    mapping(uint256 => mapping(address => uint256)) public revenueDebt;
    mapping(uint256 => mapping(address => uint256)) public revenueClaimable;
    mapping(uint256 => Listing) public listings;

    bool private locked;

    // ───────────────────────────── Events ─────────────────────────────
    event ProjectCreated(uint256 indexed id, address indexed farmer, string title, uint256 totalTokens, uint256 tokenPrice);
    event Invested(uint256 indexed id, address indexed investor, uint256 tokens, uint256 paid);
    event ProjectActivated(uint256 indexed id);
    event EvidenceSubmitted(uint256 indexed id, uint256 indexed milestone, uint256 round, string uri);
    event Voted(uint256 indexed id, uint256 indexed milestone, address indexed voter, bool approve, uint256 weight);
    event MilestoneVerified(uint256 indexed id, uint256 indexed milestone, uint256 releasedAmount);
    event MilestoneRejected(uint256 indexed id, uint256 indexed milestone);
    event ProjectFailed(uint256 indexed id, uint256 refundPool);
    event ProjectCompleted(uint256 indexed id);
    event Refunded(uint256 indexed id, address indexed investor, uint256 amount);
    event RevenueDeposited(uint256 indexed id, uint256 amount);
    event RevenueClaimed(uint256 indexed id, address indexed investor, uint256 amount);
    event Listed(uint256 indexed listingId, uint256 indexed projectId, address indexed seller, uint256 amount, uint256 pricePerToken);
    event ListingCancelled(uint256 indexed listingId);
    event Bought(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 paid);

    // ───────────────────────────── Modifiers ─────────────────────────────
    modifier nonReentrant() {
        require(!locked, "reentrancy");
        locked = true;
        _;
        locked = false;
    }

    modifier exists(uint256 id) {
        require(id < projectCount, "no project");
        _;
    }

    // ───────────────────────────── Project lifecycle ─────────────────────────────

    /// @param milestoneBps porsi pencairan tiap milestone, harus berjumlah 10_000.
    function createProject(
        string calldata title,
        string calldata metadataURI,
        uint256 tokenPrice,
        uint256 totalTokens,
        uint256 fundingDuration,
        uint256 maxYield,
        string[] calldata milestoneTitles,
        uint16[] calldata milestoneBps
    ) external returns (uint256 id) {
        require(tokenPrice > 0 && totalTokens > 0, "bad token params");
        require(fundingDuration > 0, "bad duration");
        require(milestoneTitles.length > 0 && milestoneTitles.length == milestoneBps.length, "bad milestones");
        require(maxYield >= tokenPrice * totalTokens, "maxYield < raised");

        uint256 sum;
        id = projectCount++;
        Project storage p = projects[id];
        p.farmer = msg.sender;
        p.title = title;
        p.metadataURI = metadataURI;
        p.tokenPrice = tokenPrice;
        p.totalTokens = totalTokens;
        p.fundingDeadline = block.timestamp + fundingDuration;
        p.maxYield = maxYield;

        for (uint256 i = 0; i < milestoneTitles.length; i++) {
            require(milestoneBps[i] > 0, "zero bps");
            sum += milestoneBps[i];
            milestones[id].push(Milestone(milestoneTitles[i], milestoneBps[i], "", MilestoneStatus.Pending));
        }
        require(sum == 10_000, "bps != 100%");
        emit ProjectCreated(id, msg.sender, title, totalTokens, tokenPrice);
    }

    /// @notice Beli token di pendanaan primer. Kelebihan ETH dikembalikan.
    function invest(uint256 id, uint256 tokens) external payable exists(id) nonReentrant {
        Project storage p = projects[id];
        require(p.status == ProjectStatus.Fundraising, "not fundraising");
        require(block.timestamp <= p.fundingDeadline, "funding ended");
        require(tokens > 0 && p.sold + tokens <= p.totalTokens, "bad amount");
        uint256 cost = tokens * p.tokenPrice;
        require(msg.value >= cost, "insufficient payment");

        _settle(id, msg.sender);
        balanceOf[id][msg.sender] += tokens;
        _resetDebt(id, msg.sender);
        p.sold += tokens;
        p.raised += cost;
        p.escrow += cost;
        emit Invested(id, msg.sender, tokens, cost);

        if (p.sold == p.totalTokens) {
            p.status = ProjectStatus.Active;
            emit ProjectActivated(id);
        }
        if (msg.value > cost) _send(msg.sender, msg.value - cost);
    }

    /// @notice Siapa pun boleh menutup pendanaan yang tidak terpenuhi setelah deadline -> refund penuh.
    function closeFailedFunding(uint256 id) external exists(id) {
        Project storage p = projects[id];
        require(p.status == ProjectStatus.Fundraising, "not fundraising");
        require(block.timestamp > p.fundingDeadline, "still open");
        _fail(id);
    }

    /// @notice Pengusaha menghentikan proyek: sisa escrow dikunci & dibuka untuk refund.
    function cancelProject(uint256 id) external exists(id) {
        Project storage p = projects[id];
        require(msg.sender == p.farmer, "not farmer");
        require(p.status == ProjectStatus.Active || p.status == ProjectStatus.Fundraising, "cannot cancel");
        _fail(id);
    }

    // ───────────────────────────── Evidence & verification ─────────────────────────────

    function submitEvidence(uint256 id, string calldata uri) external exists(id) {
        Project storage p = projects[id];
        require(msg.sender == p.farmer, "not farmer");
        require(p.status == ProjectStatus.Active, "not active");
        Milestone storage m = milestones[id][p.currentMilestone];
        require(m.status == MilestoneStatus.Pending, "evidence already pending");
        require(bytes(uri).length > 0, "empty uri");

        m.evidenceURI = uri;
        m.status = MilestoneStatus.UnderReview;
        p.round++;
        p.approveWeight = 0;
        p.rejectWeight = 0;
        emit EvidenceSubmitted(id, p.currentMilestone, p.round, uri);
    }

    /// @notice Investor memverifikasi (approve) atau menolak bukti. Bobot = jumlah token.
    function vote(uint256 id, bool approve) external exists(id) nonReentrant {
        Project storage p = projects[id];
        require(p.status == ProjectStatus.Active, "not active");
        uint256 mi = p.currentMilestone;
        Milestone storage m = milestones[id][mi];
        require(m.status == MilestoneStatus.UnderReview, "nothing to review");
        require(!hasVoted[id][p.round][msg.sender], "already voted");
        uint256 weight = balanceOf[id][msg.sender];
        require(weight > 0, "no tokens");

        hasVoted[id][p.round][msg.sender] = true;
        emit Voted(id, mi, msg.sender, approve, weight);

        if (approve) {
            p.approveWeight += weight;
            if (p.approveWeight * 2 > p.sold) _verify(id, mi);
        } else {
            p.rejectWeight += weight;
            if (p.rejectWeight * 2 > p.sold) {
                m.status = MilestoneStatus.Rejected;
                emit MilestoneRejected(id, mi);
                _fail(id);
            }
        }
    }

    function _verify(uint256 id, uint256 mi) private {
        Project storage p = projects[id];
        Milestone storage m = milestones[id][mi];
        m.status = MilestoneStatus.Verified;

        bool last = mi + 1 == milestones[id].length;
        uint256 amount = last ? p.escrow : (p.raised * m.bps) / 10_000;
        if (amount > p.escrow) amount = p.escrow;
        p.escrow -= amount;
        p.released += amount;
        emit MilestoneVerified(id, mi, amount);

        if (last) {
            p.status = ProjectStatus.Completed;
            emit ProjectCompleted(id);
        } else {
            p.currentMilestone = mi + 1;
        }
        _send(p.farmer, amount);
    }

    function _fail(uint256 id) private {
        Project storage p = projects[id];
        p.status = ProjectStatus.Failed;
        p.refundPool = p.escrow;
        p.refundTokens = p.sold;
        p.escrow = 0;
        emit ProjectFailed(id, p.refundPool);
    }

    // ───────────────────────────── Refund ─────────────────────────────

    /// @notice Tarik bagian proporsional dari sisa escrow saat status "Refund Available".
    function claimRefund(uint256 id) external exists(id) nonReentrant {
        Project storage p = projects[id];
        require(p.status == ProjectStatus.Failed, "no refund");
        uint256 bal = balanceOf[id][msg.sender];
        require(bal > 0, "nothing to refund");

        uint256 amount = (p.refundPool * bal) / p.refundTokens;
        p.refundPool -= amount;
        p.refundTokens -= bal;
        balanceOf[id][msg.sender] = 0;
        emit Refunded(id, msg.sender, amount);
        _send(msg.sender, amount);
    }

    function refundableOf(uint256 id, address user) external view exists(id) returns (uint256) {
        Project storage p = projects[id];
        if (p.status != ProjectStatus.Failed || p.refundTokens == 0) return 0;
        return (p.refundPool * balanceOf[id][user]) / p.refundTokens;
    }

    // ───────────────────────────── Revenue sharing ─────────────────────────────

    /// @notice Pengusaha menyetor hasil penjualan setelah proyek selesai. Dibatasi maxYield; kelebihan dikembalikan.
    function depositRevenue(uint256 id) external payable exists(id) nonReentrant {
        Project storage p = projects[id];
        require(msg.sender == p.farmer, "not farmer");
        require(p.status == ProjectStatus.Completed, "not completed");
        uint256 room = p.maxYield - p.revenueDeposited;
        uint256 amount = msg.value > room ? room : msg.value;
        require(amount > 0, "yield cap reached");

        p.revenueDeposited += amount;
        p.accRevenuePerToken += (amount * ACC) / p.sold;
        emit RevenueDeposited(id, amount);
        if (msg.value > amount) _send(msg.sender, msg.value - amount);
    }

    function pendingRevenue(uint256 id, address user) public view returns (uint256) {
        Project storage p = projects[id];
        uint256 accrued = (balanceOf[id][user] * p.accRevenuePerToken) / ACC;
        uint256 debt = revenueDebt[id][user];
        return revenueClaimable[id][user] + (accrued > debt ? accrued - debt : 0);
    }

    function claimRevenue(uint256 id) external exists(id) nonReentrant {
        _settle(id, msg.sender);
        uint256 amount = revenueClaimable[id][msg.sender];
        require(amount > 0, "nothing to claim");
        revenueClaimable[id][msg.sender] = 0;
        emit RevenueClaimed(id, msg.sender, amount);
        _send(msg.sender, amount);
    }

    function _settle(uint256 id, address user) private {
        Project storage p = projects[id];
        uint256 accrued = (balanceOf[id][user] * p.accRevenuePerToken) / ACC;
        uint256 debt = revenueDebt[id][user];
        if (accrued > debt) revenueClaimable[id][user] += accrued - debt;
        revenueDebt[id][user] = accrued;
    }

    function _resetDebt(uint256 id, address user) private {
        revenueDebt[id][user] = (balanceOf[id][user] * projects[id].accRevenuePerToken) / ACC;
    }

    // ───────────────────────────── Secondary market ─────────────────────────────

    /// @notice Listing harga tetap. Token tidak di-escrow; saldo dicek ulang saat dibeli.
    /// Syarat: minimal 1 milestone terverifikasi (atau proyek selesai).
    function list(uint256 id, uint256 amount, uint256 pricePerToken) external exists(id) returns (uint256 listingId) {
        require(_tradable(id), "market closed");
        require(amount > 0 && pricePerToken > 0, "bad params");
        require(balanceOf[id][msg.sender] >= amount, "insufficient tokens");

        listingId = listingCount++;
        listings[listingId] = Listing(id, msg.sender, amount, pricePerToken, true);
        emit Listed(listingId, id, msg.sender, amount, pricePerToken);
    }

    function cancelListing(uint256 listingId) external {
        Listing storage l = listings[listingId];
        require(l.active && l.seller == msg.sender, "not your listing");
        l.active = false;
        emit ListingCancelled(listingId);
    }

    /// @notice Beli sebagian/seluruh listing. Diblokir saat ada bukti yang sedang divoting
    /// agar bobot suara tidak bisa dihitung dua kali.
    function buy(uint256 listingId, uint256 amount) external payable nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "inactive");
        uint256 id = l.projectId;
        require(_tradable(id), "market closed");
        require(milestones[id][projects[id].currentMilestone].status != MilestoneStatus.UnderReview, "voting in progress");
        require(amount > 0 && amount <= l.amount, "bad amount");
        require(msg.sender != l.seller, "self trade");
        require(balanceOf[id][l.seller] >= amount, "seller lacks tokens");
        uint256 cost = amount * l.pricePerToken;
        require(msg.value >= cost, "insufficient payment");

        _settle(id, l.seller);
        _settle(id, msg.sender);
        balanceOf[id][l.seller] -= amount;
        balanceOf[id][msg.sender] += amount;
        _resetDebt(id, l.seller);
        _resetDebt(id, msg.sender);

        l.amount -= amount;
        if (l.amount == 0) l.active = false;
        emit Bought(listingId, msg.sender, amount, cost);

        _send(l.seller, cost);
        if (msg.value > cost) _send(msg.sender, msg.value - cost);
    }

    function _tradable(uint256 id) private view returns (bool) {
        Project storage p = projects[id];
        if (p.status == ProjectStatus.Completed) return true;
        if (p.status != ProjectStatus.Active) return false;
        return p.currentMilestone > 0; // minimal milestone pertama sudah terverifikasi
    }

    // ───────────────────────────── Views ─────────────────────────────

    function getProject(uint256 id) external view exists(id) returns (Project memory) {
        return projects[id];
    }

    function getMilestones(uint256 id) external view exists(id) returns (Milestone[] memory) {
        return milestones[id];
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    /// @notice State dashboard investor untuk satu proyek.
    function investorView(uint256 id, address user)
        external
        view
        exists(id)
        returns (uint256 tokens, uint256 refundable, uint256 revenue, bool refundAvailable, bool canVote)
    {
        Project storage p = projects[id];
        tokens = balanceOf[id][user];
        refundAvailable = p.status == ProjectStatus.Failed && tokens > 0;
        refundable = (p.status == ProjectStatus.Failed && p.refundTokens > 0) ? (p.refundPool * tokens) / p.refundTokens : 0;
        revenue = pendingRevenue(id, user);
        canVote = p.status == ProjectStatus.Active
            && tokens > 0
            && milestones[id][p.currentMilestone].status == MilestoneStatus.UnderReview
            && !hasVoted[id][p.round][user];
    }

    // ───────────────────────────── Internal ─────────────────────────────

    function _send(address to, uint256 amount) private {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
