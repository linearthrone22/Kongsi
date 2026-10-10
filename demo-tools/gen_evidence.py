"""Generate dokumen bukti demo (SVG) + KTP tersensor + manifest sha256.

Output: web/public/demo-evidence/*.svg, web/public/kyc/*.svg, web/public/demo-evidence/manifest.json
Jalankan: python demo-tools/gen_evidence.py
"""
import hashlib
import json
import os
from html import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EV_DIR = os.path.join(ROOT, "web", "public", "demo-evidence")
KYC_DIR = os.path.join(ROOT, "web", "public", "kyc")
os.makedirs(EV_DIR, exist_ok=True)
os.makedirs(KYC_DIR, exist_ok=True)

W, H = 800, 1000
FONT = "Arial, Helvetica, sans-serif"


def rp(n):
    return "Rp " + f"{n:,}".replace(",", ".")


def stamp(x, y, text, color="#1d4ed8", rot=-12):
    return (f'<g transform="rotate({rot} {x} {y})" opacity=".78">'
            f'<circle cx="{x}" cy="{y}" r="62" fill="none" stroke="{color}" stroke-width="5"/>'
            f'<circle cx="{x}" cy="{y}" r="50" fill="none" stroke="{color}" stroke-width="2"/>'
            f'<text x="{x}" y="{y - 6}" text-anchor="middle" font-size="13" font-weight="700" fill="{color}">{escape(text)}</text>'
            f'<text x="{x}" y="{y + 14}" text-anchor="middle" font-size="11" fill="{color}">★ LUNAS ★</text></g>')


def signature(x, y, color="#111"):
    return (f'<path d="M{x} {y} c 20 -30 40 25 60 -5 s 30 -20 45 10 s 25 -15 40 0" fill="none" '
            f'stroke="{color}" stroke-width="3" stroke-linecap="round"/>')


def frame(body, kind, accent="#c6f432"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="{FONT}">'
            f'<rect width="{W}" height="{H}" fill="#fbfaf6"/>'
            f'<rect x="0" y="0" width="{W}" height="10" fill="{accent}"/>'
            f'{body}'
            f'<text x="{W // 2}" y="{H - 22}" text-anchor="middle" font-size="12" fill="#9a9a9a">'
            f'{escape(kind)} · dokumen ilustrasi untuk demo Kongsi</text></svg>')


def nota(shop, addr, no, date, buyer, items, total=None, stamp_text=None, notes=(), stamp_color="#1d4ed8"):
    rows, y, s = [], 330, 0
    for name, qty, price in items:
        sub = qty * price
        s += sub
        rows.append(f'<text x="60" y="{y}" font-size="17">{escape(name)}</text>'
                    f'<text x="470" y="{y}" font-size="17" text-anchor="end">{qty:,}'.replace(",", ".") + '</text>'
                    f'<text x="600" y="{y}" font-size="17" text-anchor="end">{rp(price)}</text>'
                    f'<text x="740" y="{y}" font-size="17" text-anchor="end">{rp(sub)}</text>')
        y += 38
    total = s if total is None else total
    note_svg = "".join(f'<text x="60" y="{y + 120 + i * 26}" font-size="15" fill="#555">{escape(n)}</text>' for i, n in enumerate(notes))
    body = (f'<text x="60" y="80" font-size="30" font-weight="800" fill="#111">{escape(shop)}</text>'
            f'<text x="60" y="108" font-size="15" fill="#555">{escape(addr)}</text>'
            f'<line x1="60" y1="130" x2="740" y2="130" stroke="#222" stroke-width="2"/>'
            f'<text x="60" y="172" font-size="26" font-weight="700" letter-spacing="4">NOTA PEMBELIAN</text>'
            f'<text x="60" y="210" font-size="16">No. Nota : {escape(no)}</text>'
            f'<text x="60" y="236" font-size="16">Tanggal  : {escape(date)}</text>'
            f'<text x="440" y="210" font-size="16">Kepada : {escape(buyer)}</text>'
            f'<rect x="50" y="270" width="700" height="34" fill="#ecebe4"/>'
            f'<text x="60" y="293" font-size="15" font-weight="700">Barang</text>'
            f'<text x="470" y="293" font-size="15" font-weight="700" text-anchor="end">Qty</text>'
            f'<text x="600" y="293" font-size="15" font-weight="700" text-anchor="end">Harga</text>'
            f'<text x="740" y="293" font-size="15" font-weight="700" text-anchor="end">Subtotal</text>'
            + "".join(rows) +
            f'<line x1="400" y1="{y}" x2="740" y2="{y}" stroke="#222"/>'
            f'<text x="470" y="{y + 36}" font-size="20" font-weight="700" text-anchor="end">TOTAL</text>'
            f'<text x="740" y="{y + 36}" font-size="20" font-weight="800" text-anchor="end">{rp(total)}</text>'
            + note_svg +
            (stamp(600, 800, stamp_text, stamp_color) if stamp_text else "") +
            f'<text x="120" y="760" font-size="15" fill="#555">Penerima,</text>{signature(110, 830)}'
            f'<text x="120" y="870" font-size="15">( {escape(buyer)} )</text>')
    return frame(body, "Nota pembelian")


def laporan(title, sub, date, gps, fields, scene, checks, signer):
    fy = 300
    rows = ""
    for k, v in fields:
        rows += (f'<text x="60" y="{fy}" font-size="16" fill="#555">{escape(k)}</text>'
                 f'<text x="300" y="{fy}" font-size="16" font-weight="700">{escape(v)}</text>')
        fy += 32
    chk = "".join(f'<text x="60" y="{fy + 40 + i * 30}" font-size="16">☑ {escape(c)}</text>' for i, c in enumerate(checks))
    body = (f'<text x="60" y="78" font-size="28" font-weight="800">{escape(title)}</text>'
            f'<text x="60" y="108" font-size="16" fill="#555">{escape(sub)}</text>'
            f'<line x1="60" y1="128" x2="740" y2="128" stroke="#222" stroke-width="2"/>'
            f'<g transform="translate(60 150)">{scene}</g>'
            f'<rect x="60" y="150" width="680" height="110" fill="none" stroke="#ccc"/>'
            f'<rect x="60" y="238" width="680" height="22" fill="#000" opacity=".55"/>'
            f'<text x="730" y="254" font-size="12" text-anchor="end" fill="#fff">📍 {escape(gps)} · {escape(date)}</text>'
            + rows + chk +
            f'<text x="520" y="800" font-size="15" fill="#555">Dilaporkan oleh,</text>{signature(520, 860)}'
            f'<text x="520" y="900" font-size="15">( {escape(signer)} )</text>')
    return frame(body, "Laporan lapangan")


def scene_field(rows=7, color="#3f8f3a", sky="#9fd3f5"):
    plants = "".join(f'<path d="M{20 + i * 95} 100 q 10 -40 0 -60 M{20 + i * 95} 100 q -18 -30 -30 -32 M{20 + i * 95} 100 q 18 -30 32 -30" '
                     f'stroke="{color}" stroke-width="5" fill="none"/>' for i in range(rows))
    return (f'<rect width="680" height="110" fill="{sky}"/><rect y="70" width="680" height="40" fill="#8a5a2b"/>{plants}'
            f'<circle cx="610" cy="30" r="18" fill="#ffd34d"/>')


def scene_harvest():
    tubers = "".join(f'<ellipse cx="{60 + i * 60}" cy="{80 + (i % 2) * 8}" rx="26" ry="11" fill="#9b6b3c" transform="rotate({-15 + i * 7} {60 + i * 60} 80)"/>' for i in range(10))
    return f'<rect width="680" height="110" fill="#e9dcc3"/>{tubers}<rect x="560" y="20" width="90" height="70" fill="#c7a26a" stroke="#7a5a2a"/>'


def scene_chips():
    bags = "".join(f'<rect x="{30 + i * 75}" y="{25 + (i % 2) * 10}" width="58" height="75" rx="6" fill="#f2b632" stroke="#b07d10"/>'
                   f'<text x="{59 + i * 75}" y="{68 + (i % 2) * 10}" font-size="10" text-anchor="middle" fill="#6b3f00" font-weight="700">KERIPIK</text>' for i in range(8))
    return f'<rect width="680" height="110" fill="#fff4dc"/>{bags}'


def scene_truck():
    return ('<rect width="680" height="110" fill="#cfe8ff"/><rect y="88" width="680" height="22" fill="#555"/>'
            '<rect x="180" y="30" width="200" height="58" fill="#f5f5f5" stroke="#333"/><rect x="380" y="45" width="70" height="43" fill="#c6f432" stroke="#333"/>'
            '<circle cx="230" cy="92" r="13" fill="#222"/><circle cx="410" cy="92" r="13" fill="#222"/>'
            '<text x="280" y="66" font-size="14" text-anchor="middle" font-weight="700">KERIPIK BU SARI</text>')


def scene_boat():
    return ('<rect width="680" height="110" fill="#8fd0ff"/><rect y="70" width="680" height="40" fill="#1f6fb2"/>'
            '<path d="M220 72 h220 l-30 28 h-160 z" fill="#b5532a"/><rect x="320" y="20" width="6" height="52" fill="#333"/>'
            '<path d="M326 22 l60 40 h-60 z" fill="#fff"/>')


def invoice(title, issuer, to, no, date, lines, total, note, stamp_text):
    rows, y = "", 330
    for name, amount in lines:
        rows += (f'<text x="60" y="{y}" font-size="17">{escape(name)}</text>'
                 f'<text x="740" y="{y}" font-size="17" text-anchor="end">{rp(amount)}</text>')
        y += 38
    body = (f'<text x="60" y="80" font-size="30" font-weight="800">{escape(issuer)}</text>'
            f'<line x1="60" y1="130" x2="740" y2="130" stroke="#222" stroke-width="2"/>'
            f'<text x="60" y="172" font-size="26" font-weight="700" letter-spacing="3">{escape(title)}</text>'
            f'<text x="60" y="210" font-size="16">No : {escape(no)}</text><text x="60" y="236" font-size="16">Tanggal : {escape(date)}</text>'
            f'<text x="440" y="210" font-size="16">Kepada : {escape(to)}</text>'
            f'<rect x="50" y="270" width="700" height="34" fill="#ecebe4"/><text x="60" y="293" font-size="15" font-weight="700">Keterangan</text>'
            f'<text x="740" y="293" font-size="15" font-weight="700" text-anchor="end">Jumlah</text>' + rows +
            f'<line x1="400" y1="{y}" x2="740" y2="{y}" stroke="#222"/>'
            f'<text x="470" y="{y + 36}" font-size="20" font-weight="700" text-anchor="end">TOTAL</text>'
            f'<text x="740" y="{y + 36}" font-size="20" font-weight="800" text-anchor="end">{rp(total)}</text>'
            f'<text x="60" y="{y + 110}" font-size="15" fill="#555">{escape(note)}</text>'
            + stamp(600, 800, stamp_text, "#15803d") +
            f'<text x="120" y="760" font-size="15" fill="#555">Hormat kami,</text>{signature(110, 830)}')
    return frame(body, title.title())


def kontrak(title, party1, party2, no, date, clauses, signers):
    cl = "".join(f'<text x="60" y="{300 + i * 34}" font-size="16">{i + 1}. {escape(c)}</text>' for i, c in enumerate(clauses))
    body = (f'<text x="{W // 2}" y="90" font-size="26" font-weight="800" text-anchor="middle">{escape(title)}</text>'
            f'<text x="{W // 2}" y="122" font-size="15" text-anchor="middle" fill="#555">No. {escape(no)} · {escape(date)}</text>'
            f'<line x1="60" y1="145" x2="740" y2="145" stroke="#222" stroke-width="2"/>'
            f'<text x="60" y="190" font-size="16">PIHAK I  : {escape(party1)}</text>'
            f'<text x="60" y="220" font-size="16">PIHAK II : {escape(party2)}</text>'
            f'<text x="60" y="262" font-size="16" font-weight="700">Kedua pihak sepakat:</text>' + cl +
            f'<text x="150" y="760" font-size="15" text-anchor="middle">PIHAK I</text>{signature(100, 820)}'
            f'<text x="150" y="870" font-size="15" text-anchor="middle">( {escape(signers[0])} )</text>'
            f'<text x="620" y="760" font-size="15" text-anchor="middle">PIHAK II</text>{signature(570, 820)}'
            f'<text x="620" y="870" font-size="15" text-anchor="middle">( {escape(signers[1])} )</text>'
            f'<rect x="330" y="780" width="120" height="70" fill="#f6e7b0" stroke="#b08d1a"/>'
            f'<text x="390" y="812" font-size="12" text-anchor="middle" fill="#7a5c00">METERAI</text>'
            f'<text x="390" y="830" font-size="12" text-anchor="middle" fill="#7a5c00">10000</text>')
    return frame(body, "Kontrak")


DOCS = {
    # ── Pak Darto: pilot 1 ha ──
    "darto1-bibit": nota("Toko Tani Makmur", "Jl. Raya Kosambi No. 12, Karawang", "TTM/2026/0412", "03 Mar 2026", "Pak Darto",
                         [("Bibit stek singkong Mekarmanik", 10000, 150), ("Pupuk NPK Phonska 50kg", 6, 185000), ("Pupuk kandang (karung)", 40, 15000)],
                         stamp_text="TOKO TANI MAKMUR"),
    "darto1-rawat": laporan("Laporan Perawatan Lahan", "Pilot singkong 1 ha · Desa Kosambi", "18 Apr 2026", "-6.2727, 107.3436",
                            [("Umur tanaman", "45 hari setelah tanam"), ("Tinggi rata-rata", "62 cm"), ("Penyiangan", "2x (minggu 3 & 6)"), ("Tanaman mati/sulam", "3,1%")],
                            scene_field(), ["Penyiangan gulma selesai", "Pemupukan susulan NPK", "Foto 4 titik sampel terlampir"], "Pak Darto"),
    "darto1-panen": invoice("INVOICE PENJUALAN", "Pak Darto · Petani Singkong", "UMKM Keripik Bu Sari", "INV-DRT-0007", "12 Jun 2026",
                            [("Singkong segar grade A 21.400 kg × Rp 1.100", 23540000), ("Ongkos angkut", 0)], 23540000,
                            "Dibayar lunas via transfer BRI. Pembeli: UMKM Keripik Bu Sari (Bandung).", "PAK DARTO"),
    # ── Bu Sari: keripik 500 ──
    "sari1-bahan": nota("Pak Darto · Petani Singkong", "Desa Kosambi, Karawang", "DRT/SK/031", "14 Jun 2026", "Bu Sari",
                        [("Singkong segar grade A (kg)", 900, 1100), ("Minyak goreng 18L", 4, 310000), ("Bumbu balado & garam", 1, 420000)],
                        stamp_text="PAK DARTO"),
    "sari1-produksi": laporan("Laporan Produksi", "Keripik singkong 500 bungkus · Rumah produksi Bu Sari", "29 Jun 2026", "-6.9147, 107.6098",
                              [("Bungkus diproduksi", "512 (target 500)"), ("Varian", "Original, Balado"), ("Berat bersih", "200 g / bungkus"), ("Reject", "2,3%")],
                              scene_chips(), ["Kemasan berlabel & tanggal kedaluwarsa", "Sampel rasa dicek 3 orang", "Stok siap kirim ke warung"], "Bu Sari"),
    "sari1-jual": invoice("REKAP PENJUALAN", "UMKM Keripik Bu Sari", "Investor Kongsi", "RKP-BS-0006", "25 Jul 2026",
                          [("Penjualan 18 warung · 498 bungkus × Rp 15.000", 7470000), ("Retur 14 bungkus", -210000)], 7260000,
                          "Rekap dari buku kas & bukti transfer warung terlampir.", "BU SARI"),
    # ── Pak Darto: 3 ha ──
    "darto2-lahan": kontrak("PERJANJIAN SEWA LAHAN", "H. Mansur (pemilik lahan)", "Darto (penyewa)", "SWL/KSB/2026/07", "01 Jul 2026",
                            ["Luas lahan 3 ha di Blok Sawah Lega, Desa Kosambi.", "Masa sewa 1 musim tanam (10 bulan).", "Nilai sewa Rp 18.000.000 dibayar di muka.",
                             "Lahan dipakai untuk budidaya singkong."], ["H. Mansur", "Darto"]),
    "darto2-pupuk": nota("CV Agro Sentosa", "Jl. Tuparev No. 88, Karawang", "AGS-26-1187", "09 Jul 2026", "Pak Darto",
                         [("Bibit stek singkong (batang)", 30000, 150), ("Pupuk NPK 50kg", 18, 185000), ("Selang & pompa irigasi", 1, 2650000)],
                         stamp_text="CV AGRO SENTOSA"),
    "darto2-rawat": laporan("Laporan Perawatan Lahan", "Singkong 3 ha · Blok Sawah Lega", "20 Aug 2026", "-6.2701, 107.3512",
                            [("Umur tanaman", "60 hari setelah tanam"), ("Tinggi rata-rata", "88 cm"), ("Tenaga kerja", "6 orang (harian)"), ("Tanaman mati/sulam", "2,4%")],
                            scene_field(9), ["Penyiangan ke-3 selesai", "Irigasi berjalan 2x seminggu", "Tidak ada serangan hama tungau"], "Pak Darto"),
    "darto2-panen": kontrak("KONTRAK PEMBELIAN HASIL PANEN", "Darto (penjual)", "PT Tapioka Jaya Abadi (pembeli)", "TJA/PO/2026/221", "28 Sep 2026",
                            ["Pembeli membeli singkong segar ±64 ton.", "Harga Rp 1.150/kg, kadar pati min. 24%.", "Pembayaran 7 hari setelah timbang.",
                             "Bukti timbang: 63.820 kg (terlampir)."], ["Darto", "Rahmat S. (Purchasing)"]),
    # ── Mas Bayu: distribusi ──
    "bayu1-armada": kontrak("PERJANJIAN SEWA KENDARAAN", "CV Rental Pasundan", "Bayu Pratama", "RPS/2026/0918", "05 Aug 2026",
                            ["Sewa 2 unit pick-up box (D 8812 KA, D 8813 KA).", "Masa sewa 3 bulan termasuk servis berkala.", "Nilai sewa Rp 21.000.000.",
                             "Kendaraan untuk distribusi keripik Bu Sari."], ["Hendra (CV Rental Pasundan)", "Bayu Pratama"]),
    "bayu1-minimarket": kontrak("PERJANJIAN KERJA SAMA PEMASOKAN", "Bayu Pratama (distributor)", "Koperasi Minimarket Warga Bandung Raya", "KMW/PKS/2026/044", "14 Aug 2026",
                                ["Pemasokan keripik Bu Sari ke 30 gerai anggota.", "Sistem konsinyasi, tagihan per 2 minggu.", "Margin distributor 12%.",
                                 "Lampiran: daftar 30 alamat gerai."], ["Bayu Pratama", "Ketua Koperasi"]),
    "bayu1-laporan": laporan("Laporan Penjualan 3 Bulan", "Distribusi ke 30 minimarket · Bandung Raya", "30 Sep 2026", "-6.9175, 107.6191",
                             [("Gerai aktif", "30 / 30"), ("Bungkus terjual", "11.840"), ("Omzet bruto", "Rp 177.600.000"), ("Retur", "1,8%")],
                             scene_truck(), ["Rekap tagihan koperasi terlampir", "Rute pengiriman 2x seminggu", "Tidak ada keterlambatan bayar"], "Bayu Pratama"),
    # ── Pak Rudi: nota PALSU ──
    "rudi1-mesin-palsu": nota("Toko Mesin Bahari Jaya", "Jl. Muara Baru Ujung, Jakarta Utara", "MBJ/2026/0077", "31 Feb 2026", "Pak Rudi",
                              [("Mesin kapal Yanmar 30 PK (baru)", 1, 48000000), ("Baling-baling kuningan", 1, 3500000)],
                              total=85000000, stamp_text="TOKO TANI MAKMUR", stamp_color="#b91c1c",
                              notes=["Catatan: nota tulisan ulang, nota asli hilang.", "Nomor seri mesin: -"]),
    # ── Bu Sari: 5.000 bungkus ──
    "sari2-bahan": nota("Pak Darto · Petani Singkong", "Desa Kosambi, Karawang", "DRT/SK/058", "02 Oct 2026", "Bu Sari",
                        [("Singkong segar grade A (kg)", 3000, 1150), ("Minyak goreng 18L", 12, 310000), ("Kemasan standing pouch", 5200, 650)],
                        stamp_text="PAK DARTO"),
    "sari2-izin": invoice("SERTIFIKAT & PERIZINAN", "Dinas Kesehatan Kota Bandung · BPJPH", "UMKM Keripik Bu Sari", "P-IRT 2063273010987-31", "08 Oct 2026",
                          [("Sertifikat Produksi Pangan Industri Rumah Tangga (SPP-IRT)", 0), ("Sertifikasi halal (self declare) · biaya pendamping", 650000), ("Uji lab kadar air & cemaran", 1200000)],
                          1850000, "Nomor P-IRT dan ID halal tercetak di kemasan baru.", "BPJPH"),
}

manifest = {}
for slug, svg in DOCS.items():
    data = svg.encode("utf-8")
    with open(os.path.join(EV_DIR, f"{slug}.svg"), "wb") as f:
        f.write(data)
    manifest[slug] = {"file": f"{slug}.svg", "sha256": hashlib.sha256(data).hexdigest()}


def ktp(name, job, kab):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 540" width="860" height="540" font-family="{FONT}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe3f7"/><stop offset="1" stop-color="#8fbde8"/></linearGradient></defs>
<rect width="860" height="540" rx="28" fill="url(#g)"/>
<text x="430" y="52" text-anchor="middle" font-size="26" font-weight="700" fill="#123">PROVINSI (CONTOH)</text>
<text x="430" y="84" text-anchor="middle" font-size="22" font-weight="700" fill="#123">{escape(kab)}</text>
<g font-size="21" fill="#123">
<text x="40" y="140" font-weight="700">NIK</text><text x="210" y="140" font-weight="700">: 3215 •••• •••• ••••</text>
<text x="40" y="185">Nama</text><text x="210" y="185">: {escape(name)}</text>
<text x="40" y="222">Tempat/Tgl Lahir</text><text x="210" y="222">: ██████, ██-██-████</text>
<text x="40" y="259">Alamat</text><text x="210" y="259">: ████████████████</text>
<text x="40" y="333">Pekerjaan</text><text x="210" y="333">: {escape(job)}</text>
<text x="40" y="370">Kewarganegaraan</text><text x="210" y="370">: WNI</text></g>
<rect x="640" y="120" width="180" height="230" rx="10" fill="#222" opacity=".9"/>
<text x="730" y="245" text-anchor="middle" font-size="18" fill="#fff" font-weight="700">FOTO DISENSOR</text>
<g transform="rotate(-14 430 270)"><rect x="150" y="225" width="560" height="80" rx="12" fill="#c6f432" opacity=".92"/>
<text x="430" y="278" text-anchor="middle" font-size="40" font-weight="800" fill="#101400">KYC VERIFIED · KONGSI</text></g>
<text x="430" y="505" text-anchor="middle" font-size="16" fill="#123">ILUSTRASI DUMMY UNTUK DEMO — BUKAN DOKUMEN ASLI</text></svg>'''


for slug, name, job, kab in [("ktp-pak-darto", "DARTO", "PETANI/PEKEBUN", "KAB. KARAWANG"),
                             ("ktp-bu-sari", "SARI WULANDARI", "WIRASWASTA", "KOTA BANDUNG"),
                             ("ktp-mas-bayu", "BAYU PRATAMA", "WIRASWASTA", "KOTA BANDUNG"),
                             ("ktp-pak-rudi", "RUDI HARTONO", "NELAYAN/PERIKANAN", "JAKARTA UTARA")]:
    with open(os.path.join(KYC_DIR, f"{slug}.svg"), "wb") as f:
        f.write(ktp(name, job, kab).encode("utf-8"))

with open(os.path.join(EV_DIR, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
print(f"{len(manifest)} dokumen bukti + 4 KTP ditulis ke web/public")
