const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const E = ethers.parseEther;

describe("Kongsi", () => {
  let k, farmer, a, b, c;
  beforeEach(async () => {
    [farmer, a, b, c] = await ethers.getSigners();
    k = await ethers.deployContract("Kongsi");
    // 10 token @ 1 ETH, maxYield 15 ETH, milestone 30/40/30
    await k.connect(farmer).createProject("Petani x - 1000 bibit padi", "ipfs://meta", E("1"), 10, 3600, E("15"),
      ["Bon pembelian bibit", "Penyiraman", "Penjualan"], [3000, 4000, 3000]);
  });

  async function fund() {
    await k.connect(a).invest(0, 6, { value: E("6") });
    await k.connect(b).invest(0, 4, { value: E("4") });
  }

  it("activates when fully funded and releases per milestone on majority", async () => {
    await fund();
    expect((await k.getProject(0)).status).to.equal(1n);
    await k.connect(farmer).submitEvidence(0, "ipfs://bon");
    const before = await ethers.provider.getBalance(farmer);
    await k.connect(a).vote(0, true); // 6/10 > 50%
    expect((await ethers.provider.getBalance(farmer)) - before).to.equal(E("3"));
    expect((await k.getMilestones(0))[0].status).to.equal(2n);
  });

  it("minority approval does not release", async () => {
    await fund();
    await k.connect(farmer).submitEvidence(0, "ipfs://bon");
    await k.connect(b).vote(0, true);
    expect((await k.getMilestones(0))[0].status).to.equal(1n);
  });

  it("rejection majority fails project and enables proportional refund", async () => {
    await fund();
    await k.connect(farmer).submitEvidence(0, "ipfs://bon");
    await k.connect(a).vote(0, true);
    await k.connect(farmer).submitEvidence(0, "ipfs://siram-palsu");
    await k.connect(a).vote(0, false); // escrow left: 7 ETH
    expect((await k.getProject(0)).status).to.equal(3n);
    expect(await k.refundableOf(0, a.address)).to.equal(E("4.2"));
    expect(await k.refundableOf(0, b.address)).to.equal(E("2.8"));
    await expect(k.connect(a).claimRefund(0)).to.changeEtherBalance(a, E("4.2"));
    await expect(k.connect(b).claimRefund(0)).to.changeEtherBalance(b, E("2.8"));
  });

  it("underfunded project refunds fully after deadline", async () => {
    await k.connect(a).invest(0, 3, { value: E("3") });
    await expect(k.closeFailedFunding(0)).to.be.revertedWith("still open");
    await time.increase(3601);
    await k.closeFailedFunding(0);
    await expect(k.connect(a).claimRefund(0)).to.changeEtherBalance(a, E("3"));
  });

  it("secondary market: needs a verified milestone, blocked during voting", async () => {
    await fund();
    await expect(k.connect(a).list(0, 2, E("1.2"))).to.be.revertedWith("market closed");
    await k.connect(farmer).submitEvidence(0, "ipfs://bon");
    await k.connect(a).vote(0, true);
    await k.connect(a).list(0, 2, E("1.2"));
    await k.connect(farmer).submitEvidence(0, "ipfs://siram");
    await expect(k.connect(c).buy(0, 2, { value: E("2.4") })).to.be.revertedWith("voting in progress");
    await k.connect(a).vote(0, true);
    await expect(k.connect(c).buy(0, 2, { value: E("2.4") })).to.changeEtherBalances([a, c], [E("2.4"), -E("2.4")]);
    expect(await k.balanceOf(0, c.address)).to.equal(2n);
  });

  it("shares revenue per token up to maxYield, honoring secondary trades", async () => {
    await fund();
    for (const uri of ["1", "2", "3"]) {
      await k.connect(farmer).submitEvidence(0, uri);
      await k.connect(a).vote(0, true);
    }
    expect((await k.getProject(0)).status).to.equal(2n);
    await k.connect(a).list(0, 6, E("1.1"));
    await k.connect(c).buy(0, 6, { value: E("6.6") }); // c now holds a's tokens
    await k.connect(farmer).depositRevenue(0, { value: E("20") }); // capped at 15, rest refunded
    expect((await k.getProject(0)).revenueDeposited).to.equal(E("15"));
    await expect(k.connect(c).claimRevenue(0)).to.changeEtherBalance(c, E("9"));
    await expect(k.connect(b).claimRevenue(0)).to.changeEtherBalance(b, E("6"));
  });
});
