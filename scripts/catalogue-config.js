'use strict';

/*
 * Zale IT — canonical catalogue configuration + helpers.
 *
 * SOURCE OF TRUTH for the category/tab mapping, curated cards, brand domains and
 * the normalisation/spec helpers. Both the static-page generator
 * (scripts/build-catalogue-pages.js) and — by a hand-kept duplicate —
 * catalogue.html rely on this mapping.
 *
 * NOTE: catalogue.html carries an inline copy of TABS / FEED_CAT_TO_TAB /
 * FEED_PARENT_TO_TAB / CURATED_SECTION_TO_TAB / BRAND_DOMAINS / HIDDEN_BRANDS /
 * CURATED for its client-side rendering. That copy is intentionally duplicated;
 * if you change the mapping here, mirror it in catalogue.html (a banner comment
 * there points back to this file).
 */

// ---------------------------------------------------------------------------
// Config (mirror of catalogue.html's inline copy — keep in sync)
// ---------------------------------------------------------------------------

const HIDDEN_BRANDS = ['leader', 'resistance', 'shuttle', 'ldr'];

const TABS = [
  { id: 'laptops', label: 'Laptops' },
  { id: 'desktops', label: 'Desktops & Mini-PCs' },
  { id: 'tablets', label: 'Tablets' },
  { id: 'laptop-acc', label: 'Laptop Accessories' },
  { id: 'display', label: 'Display' },
  { id: 'mounting', label: 'Mounting Solutions' },
  { id: 'networking', label: 'Networking' },
  { id: 'components', label: 'Components' },
  { id: 'storage', label: 'Storage' },
  { id: 'power', label: 'Power Protection' },
  { id: 'projectors-audio', label: 'Projectors & Audio' },
  { id: 'other', label: 'Other & Accessories' },
];

const FEED_CAT_TO_TAB = {
  notebooks: 'laptops',
  'notebooks workstation': 'laptops',
  'desktop computers': 'desktops',
  'desktop computers workstation': 'desktops',
  tablet: 'tablets',
  'tablet accessories': 'tablets',
  'notebook accessories': 'laptop-acc',
  'bags, cases & covers': 'laptop-acc',
  'commercial bags, cases & covers': 'laptop-acc',
  'docking stations': 'laptop-acc',
  'laptop docking and cradles': 'laptop-acc',
  'charging cabinets': 'laptop-acc',
  cabinets: 'laptop-acc',
};

const FEED_PARENT_TO_TAB = {
  computers: 'laptop-acc',
  display: 'display',
  'mounting solutions': 'mounting',
  networking: 'networking',
  components: 'components',
  storage: 'storage',
  'power protection': 'power',
  projectors: 'projectors-audio',
  audio: 'projectors-audio',
  security: 'other',
  cameras: 'other',
  'graphic output': 'other',
  'av control': 'other',
  'iot edge solutions': 'other',
  software: 'other',
  printers: 'other',
};

const CURATED_SECTION_TO_TAB = {
  'Laptops & Notebooks': 'laptops',
  'Desktops & Mini-PCs': 'desktops',
  'All-in-One PCs': 'desktops',
  'Tablets & 2-in-1': 'tablets',
  Networking: 'networking',
  'UPS & Power': 'power',
  'Monitors & Mounting': 'mounting',
  Software: 'other',
  'Gaming & Workstation': 'components',
};

const BRAND_DOMAINS = {
  hp: 'hp.com', lenovo: 'lenovo.com', asus: 'asus.com', dell: 'dell.com', ubiquiti: 'ui.com',
  teltonika: 'teltonika-networks.com', apc: 'apc.com', powershield: 'powershield.com.au',
  brateck: 'brateck.com', corsair: 'corsair.com', simplecom: 'simplecom.com.au', verbatim: 'verbatim.com',
  microsoft: 'microsoft.com', synology: 'synology.com', dlink: 'dlink.com', logitech: 'logitech.com',
  kingston: 'kingston.com', samsung: 'samsung.com', sony: 'sony.com', panasonic: 'panasonic.com',
  shintaro: 'shintaro.com.au', gumdrop: 'gumdropcases.com', j5create: 'j5create.com', atdec: 'atdec.com',
  benq: 'benq.com', nec: 'nec.com', vertiv: 'vertiv.com', pelican: 'pelican.com',
  westerndigital: 'westerndigital.com', kensington: 'kensington.com', unitek: 'unitek-products.com', cherry: 'cherry.de',
};

// Curated cards — verbatim copy of catalogue.html's CURATED literal (valid JSON).
const CURATED = [{"source":"curated","brand":"Lenovo","name":"ThinkBook 14 G9","model":"NBL-14-I516512G9","specs":["14\" WUXGA","Core 5 210H","16GB DDR5","512GB SSD","Win 11 Pro"],"priceExGst":1599,"section":"Laptops & Notebooks"},{"source":"curated","brand":"Lenovo","name":"ThinkBook 16 G9","model":"NBL-16-I516512G9","specs":["16\" WUXGA","Core 5 210H","16GB DDR5","512GB SSD","Win 11 Pro"],"priceExGst":1649,"section":"Laptops & Notebooks"},{"source":"curated","brand":"Lenovo","name":"ThinkBook 14 G9","model":"NBL-14-I716512G9","specs":["14\" WUXGA","Core 7 240H","16GB DDR5","512GB SSD","Win 11 Pro"],"priceExGst":1799,"section":"Laptops & Notebooks"},{"source":"curated","brand":"Lenovo","name":"ThinkBook 16 G9","model":"NBL-16-I716512G9","specs":["16\" WUXGA","Core 7 240H","16GB DDR5","512GB SSD","Win 11 Pro"],"priceExGst":1849,"section":"Laptops & Notebooks"},{"source":"curated","brand":"Lenovo","name":"ThinkBook 14 Yoga G5","model":"NBL-14Y-U516512G5","specs":["14\" WUXGA Touch","Core Ultra 5 225U","16GB DDR5","512GB SSD","Pen"],"priceExGst":2049,"section":"Laptops & Notebooks"},{"source":"curated","brand":"Lenovo","name":"ThinkBook 14 Yoga G5","model":"NBL-14Y-U732512G5","specs":["14\" WUXGA Touch","Core Ultra 7 255U","32GB DDR5","512GB SSD","Pen"],"priceExGst":2599,"section":"Laptops & Notebooks"},{"source":"curated","brand":"Lenovo","name":"ThinkPad T14 G5","model":"NBL-T14-U516512G5","specs":["14\" WUXGA","Core Ultra 5 225H","16GB DDR5","512GB SSD","3yr Premier"],"priceExGst":2749,"section":"Laptops & Notebooks"},{"source":"curated","brand":"Lenovo","name":"ThinkPad T14 G6","model":"NBL-T14-U732512G6","specs":["14\" WUXGA","Core Ultra 7 255H","32GB DDR5","512GB SSD","3yr Premier"],"priceExGst":3149,"section":"Laptops & Notebooks"},{"source":"curated","brand":"Lenovo","name":"ThinkPad X1 Yoga 14\"","model":"NBL-X1YG-U716512TG9","specs":["14\" WUXGA Touch","Core Ultra 7 155U","16GB DDR5","512GB SSD","3yr Premier"],"priceExGst":3549,"section":"Laptops & Notebooks"},{"source":"curated","brand":"Lenovo","name":"ThinkPad X1 Carbon G13 Aura 14\"","model":"NBL-X1CB-U732512G13","specs":["14\" WUXGA Touch","Core Ultra 7 255H","32GB DDR5","512GB SSD","1kg"],"priceExGst":3799,"section":"Laptops & Notebooks"},{"source":"curated","brand":"HP","name":"ProBook 4 G1i 16\"","model":"NBHP-460-C516512G1I","specs":["16\" WUXGA","Core i5-1334U","16GB DDR5","512GB SSD","Win 11 Pro"],"priceExGst":1599,"section":"Laptops & Notebooks"},{"source":"curated","brand":"HP","name":"ProBook 4 G1i 14\"","model":"NBHP-440-C516512G1I","specs":["14\" WUXGA","Core i5-1334U","16GB DDR5","512GB SSD","Win 11 Pro"],"priceExGst":1649,"section":"Laptops & Notebooks"},{"source":"curated","brand":"HP","name":"ProBook 4 G1i 16\"","model":"NBHP-460-U716512G1I","specs":["16\" WUXGA","Core Ultra 7 255U","16GB DDR5","512GB SSD","AI Boost"],"priceExGst":2499,"section":"Laptops & Notebooks"},{"source":"curated","brand":"HP","name":"ProBook 4 G1i 14\"","model":"NBHP-440-U716512G1I","specs":["14\" WUXGA","Core Ultra 7 255U","16GB DDR5","512GB SSD","AI Boost"],"priceExGst":2599,"section":"Laptops & Notebooks"},{"source":"curated","brand":"HP","name":"EliteBook 840 G10 14\"","model":"NBHP-840-I716512LGX2","specs":["14\" WUXGA","Core i7-1355U","16GB DDR5","512GB SSD","4G"],"priceExGst":2649,"section":"Laptops & Notebooks"},{"source":"curated","brand":"HP","name":"ZBook 8 G1i Firefly 14\"","model":"NBHP-ZB814-U716512TG1IA","specs":["14\" WUXGA Touch","Core Ultra 7 255U","16GB DDR5","512GB SSD","Arc"],"priceExGst":2699,"section":"Laptops & Notebooks"},{"source":"curated","brand":"HP","name":"EliteBook 6 G1i 14\"","model":"NBHP-EB64-U716512LG1I","specs":["14\" WUXGA","Core Ultra 7 255U","16GB DDR5","512GB SSD","4G"],"priceExGst":3049,"section":"Laptops & Notebooks"},{"source":"curated","brand":"HP","name":"EliteBook 8 G1i 14\"","model":"NBHP-EB84-U516512G1IV","specs":["14\" WUXGA","Core Ultra 5 226V","16GB DDR5","512GB SSD","Arc"],"priceExGst":3249,"section":"Laptops & Notebooks"},{"source":"curated","brand":"HP","name":"EliteBook 8 G1i 14\"","model":"NBHP-EB84-U716512G1I","specs":["14\" WUXGA","Core Ultra 7 255U","16GB DDR5","512GB SSD","Arc"],"priceExGst":3549,"section":"Laptops & Notebooks"},{"source":"curated","brand":"HP","name":"EliteBook 8 G1i 16\"","model":"NBHP-EB86-U716512G1IV","specs":["16\" WUXGA","Core Ultra 7 256V","16GB DDR5","512GB SSD","Copilot+"],"priceExGst":3599,"section":"Laptops & Notebooks"},{"source":"curated","brand":"ASUS","name":"ExpertBook B1 15.6\"","model":"NBA-B1503CVA-S75315X","specs":["15.6\" FHD","Core 5 120U","16GB DDR5","512GB SSD","Win 11 Pro"],"priceExGst":1369,"section":"Laptops & Notebooks"},{"source":"curated","brand":"ASUS","name":"ExpertBook B1 14\"","model":"NBA-B1403CVA-S65042X","specs":["14\" FHD","Core 5 120U","16GB DDR5","512GB SSD","Win 11 Pro"],"priceExGst":1399,"section":"Laptops & Notebooks"},{"source":"curated","brand":"ASUS","name":"ExpertBook B3 16\"","model":"NBA-B3605CCA-MB0943X","specs":["16\" WUXGA","Core Ultra 5 225H","16GB DDR5","512GB SSD","Win 11 Pro"],"priceExGst":1739,"section":"Laptops & Notebooks"},{"source":"curated","brand":"ASUS","name":"ExpertBook B1 15.6\"","model":"NBA-B1503CVA-S75317X","specs":["15.6\" FHD","Core 7 150U","32GB DDR5","512GB SSD","Win 11 Pro"],"priceExGst":1879,"section":"Laptops & Notebooks"},{"source":"curated","brand":"ASUS","name":"ExpertBook B3 16\"","model":"NBA-B3605CCA-MB0942X","specs":["16\" WUXGA","Core Ultra 7 255H","16GB DDR5","512GB SSD","Win 11 Pro"],"priceExGst":1919,"section":"Laptops & Notebooks"},{"source":"curated","brand":"ASUS","name":"ExpertBook P5 14\"","model":"NBA-P5405CSA-U7321TB","specs":["14\" WQXGA","Core Ultra 7 258V","32GB DDR5","1TB SSD","3yr Onsite"],"priceExGst":2929,"section":"Laptops & Notebooks"},{"source":"curated","brand":"Lenovo","name":"Tab 10.1\" LTE","model":"MD-ZAEJ0033AU","specs":["10.1\" WUXGA","Android 14","4GB / 64GB","LTE","5100mAh"],"priceExGst":329,"section":"Tablets & 2-in-1"},{"source":"curated","brand":"Lenovo","name":"Idea Tab 11 5G","model":"MD-ZAFM0192AU","specs":["11\" 2.5K","Android 15","5GB / 128GB","5G","7040mAh"],"priceExGst":549,"section":"Tablets & 2-in-1"},{"source":"curated","brand":"Lenovo","name":"Yoga Tab Plus AI Wi-Fi","model":"MD-ZAEG0045AU","specs":["12.7\" 3K","Android 14","16GB / 512GB","Keyboard + Pen","NPU 20 TOPS"],"priceExGst":1499,"section":"Tablets & 2-in-1"},{"source":"curated","brand":"ASUS","name":"ExpertCenter D7 SFF","model":"D701SERES-514500133X","specs":["Core i5-14500","16GB DDR5","512GB SSD","3yr Onsite","Win 11 Pro"],"priceExGst":1299,"section":"Desktops & Mini-PCs"},{"source":"curated","brand":"ASUS","name":"ExpertCenter P440 AiO 23.8\"","model":"P440VAK-BPCJ97X","specs":["23.8\" FHD","Core 5 210H","16GB DDR5","512GB SSD","3yr Onsite"],"priceExGst":1499,"section":"All-in-One PCs"},{"source":"curated","brand":"Corsair","name":"FRAME 4000D RS Mid-Tower Case","model":"CAC-4000DRS-BK","specs":["ATX","430mm GPU","360mm rad","USB-C 3.2 Gen2"],"priceExGst":179,"section":"Gaming & Workstation"},{"source":"curated","brand":"Corsair","name":"NAUTILUS 360 RS LCD CPU Cooler","model":"CFCW-NAUT360RSLCD-BK","specs":["360mm rad","LCD pump","3× PWM fans","AM5 / LGA1851"],"priceExGst":239,"section":"Gaming & Workstation"},{"source":"curated","brand":"Corsair","name":"Vanguard 96 Mechanical Keyboard","model":"KBCH-VAN96MLXPLA-BK","specs":["MLX Plasma","8kHz","NKRO","Wrist rest"],"priceExGst":269,"section":"Gaming & Workstation"},{"source":"curated","brand":"Corsair","name":"HS80 MAX Wireless Headset","model":"SPCA-HS80MAXW-SG","specs":["50mm drivers","Dolby Atmos","24–130h","RGB"],"priceExGst":269,"section":"Gaming & Workstation"},{"source":"curated","brand":"Corsair","name":"SF1000 SFX Power Supply","model":"PSCP-SF1000","specs":["1000W","80+ Platinum","Fully modular","ATX 3.1"],"priceExGst":429,"section":"Gaming & Workstation"},{"source":"curated","brand":"Corsair","name":"HX1200i SHIFT ATX Power Supply","model":"PSCP-HX1200I-SF","specs":["1200W","80+ Platinum","Fully modular","10yr WTY"],"priceExGst":529,"section":"Gaming & Workstation"},{"source":"curated","brand":"Ubiquiti","name":"Mobile Router Ultra","model":"NHU-UMR-ULTRA","specs":[],"priceExGst":189,"section":"Networking"},{"source":"curated","brand":"Ubiquiti","name":"Cloud Gateway Fiber","model":"NHU-UCG-FIBER","specs":[],"priceExGst":559,"section":"Networking"},{"source":"curated","brand":"Ubiquiti","name":"Dream Router 7","model":"NHU-UDR7","specs":[],"priceExGst":579,"section":"Networking"},{"source":"curated","brand":"Ubiquiti","name":"Cloud Gateway Max","model":"NHU-UCG-MAX","specs":[],"priceExGst":589,"section":"Networking"},{"source":"curated","brand":"Ubiquiti","name":"AI Professional Camera","model":"NHU-UVC-AI-PRO-W","specs":[],"priceExGst":1049,"section":"Networking"},{"source":"curated","brand":"Ubiquiti","name":"Pro HD 24","model":"NHU-USW-PRO-HD-24","specs":[],"priceExGst":1259,"section":"Networking"},{"source":"curated","brand":"Ubiquiti","name":"Pro XG 10 PoE","model":"NHU-USW-PRO-XG-10-POE","specs":[],"priceExGst":1469,"section":"Networking"},{"source":"curated","brand":"Ubiquiti","name":"Pro HD 24 PoE","model":"NHU-USW-PRO-HD-24-POE","specs":[],"priceExGst":2009,"section":"Networking"},{"source":"curated","brand":"Ubiquiti","name":"Pro XG 24 PoE","model":"NHU-USW-PRO-XG-24-POE","specs":[],"priceExGst":3629,"section":"Networking"},{"source":"curated","brand":"Ubiquiti","name":"Pro XG Aggregation","model":"NHU-PRO-XG-AGGREGATION","specs":[],"priceExGst":5019,"section":"Networking"},{"source":"curated","brand":"Ubiquiti","name":"Pro XG 48 PoE","model":"NHU-USW-PRO-XG-48-POE","specs":[],"priceExGst":5109,"section":"Networking"},{"source":"curated","brand":"Teltonika","name":"TAP400 Wi-Fi 6 Access Point","model":"NHT-TAP400","specs":[],"priceExGst":199,"section":"Networking"},{"source":"curated","brand":"Teltonika","name":"SWM281 Managed Switch","model":"NHT-SWM281","specs":[],"priceExGst":479,"section":"Networking"},{"source":"curated","brand":"Teltonika","name":"RUT906 4G Router","model":"NHT-RUT906","specs":[],"priceExGst":489,"section":"Networking"},{"source":"curated","brand":"Teltonika","name":"SWM280 Managed Switch","model":"NHT-SWM280","specs":[],"priceExGst":739,"section":"Networking"},{"source":"curated","brand":"Teltonika","name":"SWM282 Managed Switch","model":"NHT-SWM282","specs":[],"priceExGst":809,"section":"Networking"},{"source":"curated","brand":"Teltonika","name":"RUTXR1 4G Router","model":"NHT-RUTXR1","specs":[],"priceExGst":929,"section":"Networking"},{"source":"curated","brand":"Teltonika","name":"RUTM30 5G Router","model":"NHT-RUTM30","specs":[],"priceExGst":1079,"section":"Networking"},{"source":"curated","brand":"Teltonika","name":"RUTC50 5G Router","model":"NHT-RUTC50","specs":[],"priceExGst":1799,"section":"Networking"},{"source":"curated","brand":"APC","name":"Back-UPS 750VA / 410W","model":"UPAPCBX750MI","specs":[],"priceExGst":179,"section":"UPS & Power"},{"source":"curated","brand":"APC","name":"Back-UPS 550VA / 330W","model":"UPAPCBE550-AZ","specs":[],"priceExGst":219,"section":"UPS & Power"},{"source":"curated","brand":"APC","name":"Back-UPS 950VA / 520W","model":"UPAPCBX950MI-AZ","specs":[],"priceExGst":229,"section":"UPS & Power"},{"source":"curated","brand":"APC","name":"Back-UPS 1200VA / 650W","model":"UPAPCBX1200MI-AZ","specs":[],"priceExGst":269,"section":"UPS & Power"},{"source":"curated","brand":"APC","name":"Back-UPS 700VA / 405W","model":"UPAPCBE700-AZ","specs":[],"priceExGst":289,"section":"UPS & Power"},{"source":"curated","brand":"APC","name":"Back-UPS 1600VA / 900W","model":"UPAPCBX1600MI-AZ","specs":[],"priceExGst":349,"section":"UPS & Power"},{"source":"curated","brand":"APC","name":"OffGrid Solar Panel 100W","model":"UPAPC-PSP100","specs":[],"priceExGst":479,"section":"UPS & Power"},{"source":"curated","brand":"APC","name":"OffGrid Power Station 330","model":"UPAPC-PPS330-AZ","specs":[],"priceExGst":699,"section":"UPS & Power"},{"source":"curated","brand":"APC","name":"OffGrid Power Station 500","model":"UPAPC-PPS500-AZ","specs":[],"priceExGst":1179,"section":"UPS & Power"},{"source":"curated","brand":"APC","name":"OffGrid Power Station 730","model":"UPAPC-PPS730-AZ","specs":[],"priceExGst":1399,"section":"UPS & Power"},{"source":"curated","brand":"PowerShield","name":"Defender 1600VA / 960W UPS","model":"UPPS-D1600VA","specs":[],"priceExGst":509,"section":"UPS & Power"},{"source":"curated","brand":"PowerShield","name":"Commander 2000VA / 1800W","model":"UPPS-PSCM2000","specs":[],"priceExGst":1579,"section":"UPS & Power"},{"source":"curated","brand":"PowerShield","name":"Centurion RT 1500VA / 1350W","model":"UPPS-PSCERT1500","specs":[],"priceExGst":1799,"section":"UPS & Power"},{"source":"curated","brand":"PowerShield","name":"Commander RT 2000VA / 1800W","model":"UPPS-CRT2000VA","specs":[],"priceExGst":1909,"section":"UPS & Power"},{"source":"curated","brand":"PowerShield","name":"Centurion RT 2000VA / 1800W","model":"UPPS-PSCERT2000","specs":[],"priceExGst":2569,"section":"UPS & Power"},{"source":"curated","brand":"PowerShield","name":"Centurion RT 3000VA / 2700W","model":"UPPS-PSCERT3000","specs":[],"priceExGst":3329,"section":"UPS & Power"},{"source":"curated","brand":"Verbatim","name":"Portable Touchscreen Monitor 15.6\"","model":"MNV-49592","specs":["15.6\" IPS","1080p FHD","Touch","Built-in speakers"],"priceExGst":419,"section":"Monitors & Mounting"},{"source":"curated","brand":"Brateck","name":"Affordable Steel Articulating Arm (Dual)","model":"MABT-LDT33-C024","specs":[],"priceExGst":169,"section":"Monitors & Mounting"},{"source":"curated","brand":"Brateck","name":"Heavy-Duty Gas Spring Arm + USB (Single)","model":"MABT-LDT82-C012UC-BK","specs":[],"priceExGst":169,"section":"Monitors & Mounting"},{"source":"curated","brand":"Brateck","name":"Economy Spring-Assisted Arm (Dual)","model":"MABT-LDT13-C024E","specs":[],"priceExGst":169,"section":"Monitors & Mounting"},{"source":"curated","brand":"Brateck","name":"Pole-Mounted Gas Spring Arm (Dual)","model":"MABT-LDT48-C024","specs":[],"priceExGst":189,"section":"Monitors & Mounting"},{"source":"curated","brand":"Brateck","name":"Premium Slim Aluminium Arm (Single)","model":"MABT-LDT49-C012-B","specs":[],"priceExGst":199,"section":"Monitors & Mounting"},{"source":"curated","brand":"Brateck","name":"Economical Spring-Assisted Arm (Dual)","model":"MABT-LDT63-C024-B","specs":[],"priceExGst":199,"section":"Monitors & Mounting"},{"source":"curated","brand":"Brateck","name":"Gas Spring Arm USB-A/USB-C (Dual)","model":"MABT-LDT81-C022UC-B","specs":[],"priceExGst":209,"section":"Monitors & Mounting"},{"source":"curated","brand":"Brateck","name":"Premium Aluminium Articulating Stand","model":"MABT-LDT72-T024","specs":[],"priceExGst":219,"section":"Monitors & Mounting"},{"source":"curated","brand":"Brateck","name":"Full Extension Gas Spring Arm (Dual)","model":"MABT-LDT16-C024","specs":[],"priceExGst":229,"section":"Monitors & Mounting"},{"source":"curated","brand":"Brateck","name":"Interactive Counterbalance Arm (Dual)","model":"MABT-LDT10-C024","specs":[],"priceExGst":299,"section":"Monitors & Mounting"},{"source":"curated","brand":"Brateck","name":"Heavy-Duty Gas Spring Arm + Handle (Dual)","model":"MABT-LDT23-C022","specs":[],"priceExGst":399,"section":"Monitors & Mounting"},{"source":"curated","brand":"Verbatim","name":"Tough Max USB-C 240W Cable 120cm","model":"CBV-66820","specs":[],"priceExGst":29,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Verbatim","name":"Go Nano Wireless Mouse","model":"MIV-49043","specs":[],"priceExGst":29,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Simplecom","name":"USB-C 5-in-1 Multiport Dock","model":"HXSI-CHT550","specs":[],"priceExGst":29,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Verbatim","name":"35W GaN Charger (2-Port)","model":"MPV-67015","specs":[],"priceExGst":35,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Simplecom","name":"SD511 M.2 SSD Docking Station","model":"HXSI-SD511","specs":[],"priceExGst":39,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Simplecom","name":"UM650 USB Condenser Microphone","model":"HXSI-UM650","specs":[],"priceExGst":39,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Verbatim","name":"USB 3.2 Card Reader 4-in-1","model":"64901","specs":[],"priceExGst":39,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Verbatim","name":"Wireless Keyboard & Mouse Combo","model":"66519","specs":[],"priceExGst":39,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Verbatim","name":"Clarity Sound Headset","model":"SPV-30195","specs":[],"priceExGst":39,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Simplecom","name":"DA451 5-in-1 USB-C Adapter","model":"HXSI-DA451","specs":[],"priceExGst":49,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Simplecom","name":"SE523 M.2 2230 NVMe Enclosure","model":"HXSI-SE523","specs":[],"priceExGst":49,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Simplecom","name":"NW812v2 WiFi 6E USB Adapter","model":"HXSI-NW812V2","specs":[],"priceExGst":49,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Verbatim","name":"65W GaN Charger (3-Port)","model":"MPV-67016","specs":[],"priceExGst":65,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Simplecom","name":"48W 10-Port USB 3.0 Hub","model":"HXSI-CHU810","specs":[],"priceExGst":69,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Simplecom","name":"CHT595 9-in-1 USB-C Dock + NVMe","model":"HXSI-CHT595","specs":[],"priceExGst":69,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Verbatim","name":"1080p FHD Auto Focus Webcam","model":"VIV-66631","specs":[],"priceExGst":79,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Verbatim","name":"External Slimline CD/DVD Writer","model":"CMV98938","specs":[],"priceExGst":79,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Verbatim","name":"Active Noise Cancelling Headset","model":"SPV-66706","specs":[],"priceExGst":89,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Simplecom","name":"CHN622 USB-C 12-in-1 Dock + Stand","model":"HXSI-CHN622","specs":[],"priceExGst":89,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Verbatim","name":"100W GaN Charger (4-Port)","model":"MPV-66966","specs":[],"priceExGst":99,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Verbatim","name":"140W GaN Charger (4-Port)","model":"MPV-67035","specs":[],"priceExGst":139,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Simplecom","name":"SD550v2 Dual Bay NVMe Dock","model":"HXSI-SD550V2","specs":[],"priceExGst":149,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Simplecom","name":"CHT815 15-in-1 USB-C 4K Triple Dock","model":"HXSI-CHT815","specs":[],"priceExGst":159,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Simplecom","name":"CHT660 Laptop Stand + 6-Port USB-C Dock","model":"NASI-CHT660","specs":[],"priceExGst":159,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Verbatim","name":"Store&#x27;n&#x27;Go Grid Hard Drive 1TB","model":"HXV-GRID1TB-BLK","specs":[],"priceExGst":159,"section":"Docks, Cables & Accessories"},{"source":"curated","brand":"Microsoft","name":"Office Home & Student 2024","model":"SMS-OFHS2024-ML-1U","specs":[],"priceExGst":249,"section":"Software"},{"source":"curated","brand":"Microsoft","name":"Windows 11 Home (OEM)","model":"SMSWIN11HOME64","specs":[],"priceExGst":249,"section":"Software"},{"source":"curated","brand":"Microsoft","name":"Windows 11 Home (Retail USB)","model":"SMS-WIN11HRET-USB","specs":[],"priceExGst":269,"section":"Software"},{"source":"curated","brand":"Microsoft","name":"Windows 11 Pro (OEM)","model":"SMSWIN11PROEM64","specs":[],"priceExGst":359,"section":"Software"},{"source":"curated","brand":"Microsoft","name":"Windows 11 Pro (Retail USB)","model":"SMS-WIN11PRORET-USB","specs":[],"priceExGst":399,"section":"Software"},{"source":"curated","brand":"Microsoft","name":"Office Home & Business 2024","model":"SMS-OFFHB2024-ML","specs":[],"priceExGst":439,"section":"Software"}];

// Laptop subcategories (exact CategoryName / feed subCategory, lowercased).
const LAPTOP_SUBCATEGORIES = ['notebooks', 'notebooks workstation'];

// ---------------------------------------------------------------------------
// Helpers (Node-safe ports of catalogue.html's helpers)
// ---------------------------------------------------------------------------

function lc(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

// HTML-escape (matches catalogue.html's textContent-based esc: & < > " ').
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(n) {
  return '$' + (Math.round(Number(n) || 0)).toLocaleString('en-AU');
}

// Enquiry deep-link into the homepage contact form. Root-absolute so it works
// from the generated /category/ and /product/ sub-paths (catalogue.html uses a
// relative 'index.html' because it sits at the site root).
function enquiryHref(label) {
  return '/index.html?enquiry=' + encodeURIComponent(label) + '#contact';
}

function brandKey(b) {
  return lc(b).replace(/[^a-z0-9]/g, '');
}

function brandDomain(b) {
  return BRAND_DOMAINS[brandKey(b)] || null;
}

// Encode spaces / unsafe path chars in an image URL's PATH only. Feed URLs are
// absolute (https://…) so no base is needed (unlike the browser version).
function encodeImageUrl(u) {
  if (!u) return '';
  try {
    const url = new URL(u);
    url.pathname = url.pathname
      .split('/')
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join('/');
    return url.toString();
  } catch (e) {
    return String(u).replace(/ /g, '%20');
  }
}

// Catalogue-card spec line (matches catalogue.html's parseSpecLine).
function parseSpecLine(name) {
  let n = String(name || ''), parts = [], m;
  if ((m = n.match(/\bCore\s+Ultra\s+[579][\w-]*/i))) parts.push('Intel ' + m[0]);
  else if ((m = n.match(/\b[Uu][579]-\d{3}[A-Z]?\b/))) parts.push('Intel ' + m[0].toUpperCase());
  else if ((m = n.match(/\bi[3579]-\d{3,5}[A-Z]*\b/i))) parts.push('Intel Core ' + m[0]);
  else if ((m = n.match(/\bRyzen\s+[3579][\w\s-]*?\d{3,4}[A-Z]*\b/i))) parts.push('AMD ' + m[0].replace(/\s+/g, ' ').trim());
  else if ((m = n.match(/\bSnapdragon\s+X[\w\s-]*\b/i))) parts.push(m[0].replace(/\s+/g, ' ').trim());
  const caps = n.match(/\b\d{1,4}\s?(GB|TB)\b/gi);
  if (caps && caps.length >= 2) {
    parts.push(caps[0].toUpperCase().replace(/\s/g, '') + ' RAM');
    parts.push(caps[1].toUpperCase().replace(/\s/g, '') + ' SSD');
  }
  const scr = n.match(/\b(\d{2})"\s*(WUXGA|FHD|OLED|UHD|QHD)?/i);
  if (scr) parts.push(scr[1] + '"' + (scr[2] ? ' ' + scr[2].toUpperCase() : ''));
  return parts.join(' · ');
}

function snippet(desc, max) {
  max = max || 100;
  const t = String(desc || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  let cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  if (sp > max * 0.4) cut = cut.slice(0, sp);
  return cut + '…';
}

// Structured laptop spec parser (ported from build-clearance-campaign.js) —
// used for the richer laptop product pages (CPU / RAM / storage / screen).
function parseSpecs(name) {
  const n = String(name || '');
  const specs = {};
  let m;
  if ((m = n.match(/\bCore\s+Ultra\s+[579][\w-]*/i))) specs.cpu = `Intel ${m[0].replace(/\s+/g, ' ')}`;
  else if ((m = n.match(/\b[Uu][579]-\d{3}[A-Z]?\b/))) specs.cpu = `Intel ${m[0].toUpperCase()}`;
  else if ((m = n.match(/\bCore\s+i[3579][- ]?\d{3,5}[A-Z]*\b/i))) specs.cpu = `Intel ${m[0]}`;
  else if ((m = n.match(/\bi[3579]-\d{3,5}[A-Z]*\b/i))) specs.cpu = `Intel Core ${m[0]}`;
  else if ((m = n.match(/\bRyzen\s+[3579][\w\s-]*?\d{3,4}[A-Z]*\b/i))) specs.cpu = `AMD ${m[0].replace(/\s+/g, ' ').trim()}`;
  else if ((m = n.match(/\bRyzen\s+[3579]\b/i))) specs.cpu = `AMD ${m[0]}`;
  else if ((m = n.match(/\bSnapdragon\s+X[\w\s-]*\b/i))) specs.cpu = m[0].replace(/\s+/g, ' ').trim();

  const caps = [...n.matchAll(/\b(\d{1,4})\s?(GB|TB)\b/gi)].map((x) => ({
    value: parseInt(x[1], 10), unit: x[2].toUpperCase(), raw: `${x[1]}${x[2].toUpperCase()}`,
  }));
  if (caps.length >= 2) { specs.ram = caps[0].raw; specs.storage = caps[1].raw; }
  else if (caps.length === 1) {
    const c = caps[0];
    if (c.unit === 'TB' || c.value >= 128) specs.storage = c.raw; else specs.ram = c.raw;
  }
  if ((m = n.match(/\b(\d{2})"\s*([A-Z]{2,5})?/))) {
    const panel = m[2] && /^(WUXGA|FHD|OLED|UHD|QHD|WQXGA|WQHD)$/i.test(m[2]) ? ` ${m[2].toUpperCase()}` : '';
    specs.screen = `${m[1]}"${panel}`;
  }
  return specs;
}

function specLine(specs) {
  const parts = [];
  if (specs.cpu) parts.push(specs.cpu);
  if (specs.ram) parts.push(`${specs.ram} RAM`);
  if (specs.storage) parts.push(`${specs.storage} SSD`);
  if (specs.screen) parts.push(specs.screen);
  return parts.join(' · ');
}

// Box-damaged / open-box / refurbished units — never get individual pages.
function isExcludedUnit(name) {
  return /box damage|box damaged|open box|damaged|b-grade|refurb|refurbished|ex-demo|ex demo/i.test(name || '');
}

// URL slug from a product code: lowercase alphanumerics, dashes between.
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Routing + normalisation (ports of catalogue.html)
// ---------------------------------------------------------------------------

function feedTab(p) {
  const c = lc(p.subCategory);
  if (FEED_CAT_TO_TAB[c]) return FEED_CAT_TO_TAB[c];
  return FEED_PARENT_TO_TAB[lc(p.category)] || null;
}

function curatedTab(c) {
  if (c.section === 'Docks, Cables & Accessories') return lc(c.brand) === 'verbatim' ? 'storage' : 'components';
  return CURATED_SECTION_TO_TAB[c.section] || 'other';
}

function normFeed(p) {
  if (HIDDEN_BRANDS.indexOf(lc(p.brand)) !== -1) return null;
  const tab = feedTab(p);
  if (!tab) return null;
  return {
    source: 'feed', brand: p.brand || '', name: p.name || '', tab,
    priceExGst: Number(p.rrp) || 0, specs: null,
    specLine: parseSpecLine(p.name) || snippet(p.description),
    image: p.image || null, model: p.sku || p.code || null, code: p.code || null,
    stock: (p.stock != null ? p.stock : null), eta: p.eta || null,
    description: p.description || '', subCategory: p.subCategory || '', category: p.category || '',
  };
}

function normCurated(c) {
  if (HIDDEN_BRANDS.indexOf(lc(c.brand)) !== -1) return null;
  return {
    source: 'curated', brand: c.brand || '', name: c.name || '', tab: curatedTab(c),
    priceExGst: Number(c.priceExGst) || 0,
    specs: (c.specs && c.specs.length ? c.specs : null), specLine: null,
    image: null, model: c.model || null, code: c.model || null, stock: null, eta: null,
    description: '', section: c.section || '',
  };
}

function isLaptopFeedProduct(p) {
  return LAPTOP_SUBCATEGORIES.includes(lc(p.subCategory));
}

module.exports = {
  HIDDEN_BRANDS, TABS, FEED_CAT_TO_TAB, FEED_PARENT_TO_TAB, CURATED_SECTION_TO_TAB,
  BRAND_DOMAINS, CURATED, LAPTOP_SUBCATEGORIES,
  lc, escapeHtml, money, enquiryHref, brandKey, brandDomain, encodeImageUrl,
  parseSpecLine, snippet, parseSpecs, specLine, isExcludedUnit, slugify,
  feedTab, curatedTab, normFeed, normCurated, isLaptopFeedProduct,
};
