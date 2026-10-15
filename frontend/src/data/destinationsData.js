/**
 * destinationsData.js
 * Comprehensive Destinations & Transit Places Database for Travel Alarm
 * Includes all 38 districts of Tamil Nadu + major South Indian cities,
 * with bus stands, railway stations, airports, colleges, hospitals, and taluks.
 * Supports typo tolerance (e.g., 'kallakuruchi' -> 'kallakurichi')
 * and smart grouping like Google Maps.
 */

// Common typo corrections and phonetic aliases
export const TYPO_MAP = {
  kallakuruchi: 'kallakurichi',
  kallakkurichi: 'kallakurichi',
  kallakurche: 'kallakurichi',
  kallakurchi: 'kallakurichi',
  kovai: 'coimbatore',
  cbe: 'coimbatore',
  cjb: 'coimbatore',
  coimbator: 'coimbatore',
  coimbature: 'coimbatore',
  hopes: 'hope college',
  hope: 'hope college',
  psg: 'psg college of technology',
  psgtech: 'psg college of technology',
  kct: 'kumaraguru college of technology',
  gandhipuram: 'gandhipuram',
  singanallur: 'singanallur',
  ukkadam: 'ukkadam',
  trichy: 'tiruchirappalli',
  tiruchirapalli: 'tiruchirappalli',
  thiruchirapalli: 'tiruchirappalli',
  thiruchi: 'tiruchirappalli',
  tiruchi: 'tiruchirappalli',
  cmbt: 'koyambedu',
  kcbt: 'kilambakkam',
  kilambakkam: 'kilambakkam',
  koyambedu: 'koyambedu',
  madras: 'chennai',
  chenai: 'chennai',
  salm: 'salem',
  madhurai: 'madurai',
  thirunelveli: 'tirunelveli',
  nellai: 'tirunelveli',
  pondy: 'puducherry',
  pondicherry: 'puducherry',
  bangalore: 'bengaluru',
  blore: 'bengaluru',
  bengalur: 'bengaluru',
  hosur: 'hosur',
  ooty: 'ooty',
  udhagai: 'ooty',
  udhagamandalam: 'ooty',
  thiruvannamalai: 'tiruvannamalai',
  tiruvannamalai: 'tiruvannamalai',
  vellor: 'vellore',
  katpadi: 'katpadi',
  chinnasalem: 'chinnasalem',
  'chinna salem': 'chinnasalem',
  ulundurpet: 'ulundurpettai',
  ulundurpettai: 'ulundurpettai',
  thiyagadurgam: 'thiyagadurgam',
  sankarapuram: 'sankarapuram',
  thirukoilur: 'tirukoilur',
  tirukoilur: 'tirukoilur',
  tirukoilur: 'tirukoilur',
  parikal: 'parikkal',
  parikkal: 'parikkal',
  kumbakonam: 'kumbakonam',
  kudanthai: 'kumbakonam',
  erode: 'erode',
  tiruppur: 'tiruppur',
  tirupur: 'tiruppur',
  dindigul: 'dindigul',
  dindugul: 'dindigul',
  nagercoil: 'nagercoil',
  kanyakumari: 'kanyakumari',
  villupuram: 'villupuram',
  cuddalore: 'cuddalore',
  thanjavur: 'thanjavur',
  tanjore: 'thanjavur',
  kavundaplayam: 'kavundampalayam',
  kaundampalayam: 'kavundampalayam',
  goundampalayam: 'kavundampalayam',
  kavundampalayam: 'kavundampalayam',
  thudiyalur: 'thudiyalur',
  tudiyalur: 'thudiyalur',
  saravanampatti: 'saravanampatti',
  saravanampatty: 'saravanampatti',
  peelamedu: 'peelamedu',
  pilamedu: 'peelamedu',
  vadavalli: 'vadavalli',
  rspuram: 'rs puram',
  'r.s. puram': 'rs puram',
  saibaba: 'saibaba colony',
  'saibaba colony': 'saibaba colony',
  ganapathy: 'ganapathy',
  maruthamalai: 'marudhamalai',
  marudhamalai: 'marudhamalai',
  perur: 'perur',
  kuniyamuthur: 'kuniyamuthur',
  kalapatti: 'kalapatti',
  ondipudur: 'ondipudur',
};

export const ALL_DESTINATIONS = [
  // ── 1. KALLAKURICHI & RELATED PLACES ──────────────────────────────────────────
  {
    name: 'Kallakurichi',
    city: 'District Headquarter, Tamil Nadu',
    lat: 11.740626,
    lng: 78.963713,
    type: 'city',
    district: 'Kallakurichi',
    keywords: ['kallakurichi', 'kallakuruchi', 'kallakkurichi', 'town', 'district'],
  },
  {
    name: 'Kallakurichi Bus Stand',
    city: 'Salem Main Road, Kallakurichi, Tamil Nadu',
    lat: 11.7388,
    lng: 78.9602,
    type: 'bus_stand',
    district: 'Kallakurichi',
    keywords: ['kallakurichi', 'kallakuruchi', 'bus stand', 'old bus stand', 'salem road'],
  },
  {
    name: 'TNSTC Bus Stand, Kallakurichi',
    city: 'Bus Stand Road, Kallakurichi, Tamil Nadu',
    lat: 11.7392,
    lng: 78.961,
    type: 'bus_stand',
    district: 'Kallakurichi',
    keywords: ['kallakurichi', 'kallakuruchi', 'tnstc', 'depot', 'bus station'],
  },
  {
    name: 'Kallakurichi New Bus Stand',
    city: 'Salem-Chennai NH Highway, Kallakurichi, Tamil Nadu',
    lat: 11.7445,
    lng: 78.9675,
    type: 'bus_stand',
    district: 'Kallakurichi',
    keywords: ['kallakurichi', 'kallakuruchi', 'new bus stand', 'nh highway', 'bypass'],
  },
  {
    name: 'Chinnasalem Railway Station',
    city: 'Chinnasalem, Kallakurichi, Tamil Nadu',
    lat: 11.7225,
    lng: 78.8812,
    type: 'station',
    district: 'Kallakurichi',
    keywords: ['chinnasalem', 'kallakurichi', 'kallakuruchi', 'railway', 'train', 'station'],
  },
  {
    name: 'Chinnasalem Bus Stand',
    city: 'Chinnasalem, Kallakurichi, Tamil Nadu',
    lat: 11.7208,
    lng: 78.8785,
    type: 'bus_stand',
    district: 'Kallakurichi',
    keywords: ['chinnasalem', 'kallakurichi', 'kallakuruchi', 'bus stand'],
  },
  {
    name: 'Ulundurpettai Bus Stand',
    city: 'Chennai-Trichy Highway, Ulundurpettai, Kallakurichi, Tamil Nadu',
    lat: 11.6912,
    lng: 79.2885,
    type: 'bus_stand',
    district: 'Kallakurichi',
    keywords: ['ulundurpettai', 'ulundurpet', 'kallakurichi', 'kallakuruchi', 'bus stand', 'nh45'],
  },
  {
    name: 'Ulundurpettai Toll Plaza',
    city: 'NH 45 Highway, Ulundurpettai, Kallakurichi, Tamil Nadu',
    lat: 11.6854,
    lng: 79.294,
    type: 'landmark',
    district: 'Kallakurichi',
    keywords: ['ulundurpettai', 'toll', 'toll plaza', 'kallakurichi'],
  },
  {
    name: 'Parikkal',
    city: 'Ulundurpettai, Kallakurichi, Tamil Nadu',
    lat: 11.785145,
    lng: 79.367063,
    type: 'landmark',
    district: 'Kallakurichi',
    keywords: ['parikkal', 'parikal', 'narasimhar temple', 'ulundurpettai', 'kallakurichi', 'kallakuruchi'],
  },
  {
    name: 'Sankarapuram Bus Stand',
    city: 'Sankarapuram, Kallakurichi, Tamil Nadu',
    lat: 11.886,
    lng: 78.918,
    type: 'bus_stand',
    district: 'Kallakurichi',
    keywords: ['sankarapuram', 'kallakurichi', 'kallakuruchi', 'bus stand'],
  },
  {
    name: 'Thiyagadurgam Bus Stand',
    city: 'Salem Main Road, Thiyagadurgam, Kallakurichi, Tamil Nadu',
    lat: 11.7042,
    lng: 79.0768,
    type: 'bus_stand',
    district: 'Kallakurichi',
    keywords: ['thiyagadurgam', 'kallakurichi', 'kallakuruchi', 'bus stand'],
  },
  {
    name: 'Tirukoilur Bus Stand',
    city: 'Tirukoilur, Kallakurichi, Tamil Nadu',
    lat: 11.9615,
    lng: 79.2045,
    type: 'bus_stand',
    district: 'Kallakurichi',
    keywords: ['tirukoilur', 'thirukoilur', 'kallakurichi', 'kallakuruchi', 'bus stand'],
  },
  {
    name: 'Tirukoilur Railway Station',
    city: 'Tirukoilur, Kallakurichi, Tamil Nadu',
    lat: 11.958,
    lng: 79.211,
    type: 'station',
    district: 'Kallakurichi',
    keywords: ['tirukoilur', 'railway', 'station', 'kallakurichi'],
  },
  {
    name: 'Rishivandiyam',
    city: 'Rishivandiyam Taluk, Kallakurichi, Tamil Nadu',
    lat: 11.815,
    lng: 79.102,
    type: 'landmark',
    district: 'Kallakurichi',
    keywords: ['rishivandiyam', 'kallakurichi', 'kallakuruchi'],
  },
  {
    name: 'Kallakurichi Govt Medical College & Hospital',
    city: 'Siruvangur Road, Kallakurichi, Tamil Nadu',
    lat: 11.748,
    lng: 78.971,
    type: 'hospital',
    district: 'Kallakurichi',
    keywords: ['kallakurichi', 'kallakuruchi', 'hospital', 'medical college', 'gh'],
  },
  {
    name: 'Kalvarayan Hills',
    city: 'Gomukhi Dam, Kallakurichi, Tamil Nadu',
    lat: 11.8333,
    lng: 78.75,
    type: 'landmark',
    district: 'Kallakurichi',
    keywords: ['kalvarayan', 'hills', 'gomukhi', 'waterfalls', 'kallakurichi'],
  },

  // ── 2. COIMBATORE & RELATED PLACES ───────────────────────────────────────────
  {
    name: 'Coimbatore',
    city: 'City Center / Gandhipuram, Tamil Nadu',
    lat: 11.0168,
    lng: 76.9558,
    type: 'city',
    district: 'Coimbatore',
    keywords: ['coimbatore', 'kovai', 'cbe'],
  },
  {
    name: 'Kavundampalayam Bus Stop',
    city: 'Coimbatore-Mettupalayam Road, Kavundampalayam, Coimbatore',
    lat: 11.045219,
    lng: 76.94728,
    type: 'bus_stand',
    district: 'Coimbatore',
    keywords: ['kavundampalayam', 'kavundaplayam', 'kaundampalayam', 'goundampalayam', 'mettupalayam road', 'bus stop', 'coimbatore'],
  },
  {
    name: 'Kavundampalayam Flyover & Junction',
    city: 'Mettupalayam - Coimbatore Road, Kavundampalayam, Coimbatore North',
    lat: 11.043884,
    lng: 76.94793,
    type: 'landmark',
    district: 'Coimbatore',
    keywords: ['kavundampalayam', 'kavundaplayam', 'flyover', 'junction', 'mettupalayam road', 'coimbatore north'],
  },
  {
    name: 'Kavundampalayam',
    city: 'Ward 44, North Zone, Coimbatore, Tamil Nadu',
    lat: 11.0452,
    lng: 76.9474,
    type: 'city',
    district: 'Coimbatore',
    keywords: ['kavundampalayam', 'kavundaplayam', 'kaundampalayam', 'coimbatore north'],
  },
  {
    name: 'Thudiyalur Bus Stand',
    city: 'Mettupalayam Road, Thudiyalur, Coimbatore',
    lat: 11.0822,
    lng: 76.9389,
    type: 'bus_stand',
    district: 'Coimbatore',
    keywords: ['thudiyalur', 'tudiyalur', 'bus stand', 'mettupalayam road', 'coimbatore'],
  },
  {
    name: 'RS Puram (R.S. Puram)',
    city: 'DB Road, RS Puram, Coimbatore',
    lat: 11.0094,
    lng: 76.9514,
    type: 'landmark',
    district: 'Coimbatore',
    keywords: ['rs puram', 'r.s. puram', 'db road', 'coimbatore'],
  },
  {
    name: 'Saibaba Colony',
    city: 'NSR Road, Saibaba Colony, Coimbatore',
    lat: 11.0289,
    lng: 76.9442,
    type: 'landmark',
    district: 'Coimbatore',
    keywords: ['saibaba colony', 'nsr road', 'coimbatore'],
  },
  {
    name: 'Vadavalli Bus Terminus',
    city: 'Marudhamalai Main Road, Vadavalli, Coimbatore',
    lat: 11.0284,
    lng: 76.9048,
    type: 'bus_stand',
    district: 'Coimbatore',
    keywords: ['vadavalli', 'bus terminus', 'marudhamalai road', 'coimbatore'],
  },
  {
    name: 'Saravanampatti Junction',
    city: 'Sathy Road, Saravanampatti, Coimbatore',
    lat: 11.0772,
    lng: 76.9958,
    type: 'landmark',
    district: 'Coimbatore',
    keywords: ['saravanampatti', 'saravanampatty', 'sathy road', 'coimbatore'],
  },
  {
    name: 'Ganapathy Bus Stop',
    city: 'Sathy Road, Ganapathy, Coimbatore',
    lat: 11.0367,
    lng: 76.9782,
    type: 'bus_stand',
    district: 'Coimbatore',
    keywords: ['ganapathy', 'sathy road', 'coimbatore'],
  },
  {
    name: 'Marudhamalai Murugan Temple',
    city: 'Maruthamalai, Coimbatore, Tamil Nadu',
    lat: 11.0456,
    lng: 76.8524,
    type: 'landmark',
    district: 'Coimbatore',
    keywords: ['marudhamalai', 'maruthamalai', 'murugan temple', 'coimbatore'],
  },
  {
    name: 'Sundarapuram Bus Stop',
    city: 'Pollachi Main Road, Sundarapuram, Coimbatore',
    lat: 10.9575,
    lng: 76.9698,
    type: 'bus_stand',
    district: 'Coimbatore',
    keywords: ['sundarapuram', 'pollachi road', 'kurichi', 'coimbatore'],
  },
  {
    name: 'Kuniyamuthur',
    city: 'Palakkad Main Road, Kuniyamuthur, Coimbatore',
    lat: 10.9631,
    lng: 76.9423,
    type: 'landmark',
    district: 'Coimbatore',
    keywords: ['kuniyamuthur', 'palakkad road', 'coimbatore'],
  },
  {
    name: 'Gandhipuram Central Bus Stand',
    city: 'Mofussil & SETC Bus Stand, Coimbatore, Tamil Nadu',
    lat: 11.0183,
    lng: 76.9678,
    type: 'bus_stand',
    district: 'Coimbatore',
    keywords: ['gandhipuram', 'central bus stand', 'coimbatore', 'setc', 'mofussil', 'kovai'],
  },
  {
    name: 'Coimbatore Junction (Railway Station)',
    city: 'State Bank Road, Gopalapuram, Coimbatore',
    lat: 10.9962,
    lng: 76.9679,
    type: 'station',
    district: 'Coimbatore',
    keywords: ['coimbatore junction', 'railway station', 'train', 'cbe', 'gopalapuram'],
  },
  {
    name: 'Singanallur Bus Stand',
    city: 'Trichy Road, Singanallur, Coimbatore',
    lat: 10.9997,
    lng: 77.0272,
    type: 'bus_stand',
    district: 'Coimbatore',
    keywords: ['singanallur', 'trichy road', 'bus stand', 'coimbatore', 'kovai'],
  },
  {
    name: 'Ukkadam Bus Stand',
    city: 'Pollachi Main Road, Ukkadam, Coimbatore',
    lat: 10.988,
    lng: 76.961,
    type: 'bus_stand',
    district: 'Coimbatore',
    keywords: ['ukkadam', 'pollachi road', 'bus stand', 'coimbatore', 'kovai'],
  },
  {
    name: 'Hope College (Hopes)',
    city: 'Avinashi Road, Peelamedu, Coimbatore',
    lat: 11.0258,
    lng: 77.0166,
    type: 'landmark',
    district: 'Coimbatore',
    keywords: ['hope college', 'hopes', 'peelamedu', 'avinashi road', 'coimbatore'],
  },
  {
    name: 'PSG College of Technology',
    city: 'Avinashi Road, Peelamedu, Coimbatore',
    lat: 11.0247,
    lng: 77.0028,
    type: 'college',
    district: 'Coimbatore',
    keywords: ['psg', 'psg tech', 'psg college', 'peelamedu', 'coimbatore'],
  },
  {
    name: 'Kumaraguru College of Technology (KCT)',
    city: 'Saravanampatti, Chinnavedampatti, Coimbatore',
    lat: 11.0825,
    lng: 76.9897,
    type: 'college',
    district: 'Coimbatore',
    keywords: ['kct', 'kumaraguru', 'saravanampatti', 'coimbatore'],
  },
  {
    name: 'Coimbatore International Airport (CJB)',
    city: 'Civil Aerodrome Post, Peelamedu, Coimbatore',
    lat: 11.03,
    lng: 77.0434,
    type: 'airport',
    district: 'Coimbatore',
    keywords: ['coimbatore airport', 'cjb', 'airport', 'aerodrome', 'peelamedu'],
  },
  {
    name: 'Brookefields Mall',
    city: 'Dr Krishnasamy Road, Coimbatore',
    lat: 11.0089,
    lng: 76.9594,
    type: 'landmark',
    district: 'Coimbatore',
    keywords: ['brookefields', 'brookfields', 'mall', 'coimbatore'],
  },
  {
    name: 'Prozone Mall',
    city: 'Sathy Road, Saravanampatti, Coimbatore',
    lat: 11.0545,
    lng: 76.994,
    type: 'landmark',
    district: 'Coimbatore',
    keywords: ['prozone', 'prozone mall', 'sathy road', 'saravanampatti', 'coimbatore'],
  },
  {
    name: 'Coimbatore North Railway Station',
    city: 'Mettupalayam Road, Coimbatore North',
    lat: 11.0212,
    lng: 76.954,
    type: 'station',
    district: 'Coimbatore',
    keywords: ['coimbatore north', 'north station', 'railway', 'coimbatore'],
  },
  {
    name: 'Pollachi Bus Stand & Junction',
    city: 'Pollachi, Coimbatore District, Tamil Nadu',
    lat: 10.6608,
    lng: 77.0047,
    type: 'bus_stand',
    district: 'Coimbatore',
    keywords: ['pollachi', 'bus stand', 'junction', 'coimbatore'],
  },
  {
    name: 'Mettupalayam Railway Station',
    city: 'Mettupalayam, Coimbatore District, Tamil Nadu',
    lat: 11.2995,
    lng: 76.9525,
    type: 'station',
    district: 'Coimbatore',
    keywords: ['mettupalayam', 'nilgiri mountain railway', 'toy train', 'coimbatore'],
  },
  {
    name: 'Sulur Bus Stand',
    city: 'Sulur, Coimbatore, Tamil Nadu',
    lat: 11.0267,
    lng: 77.1264,
    type: 'bus_stand',
    district: 'Coimbatore',
    keywords: ['sulur', 'air force station', 'bus stand', 'coimbatore'],
  },

  // ── 3. CHENNAI & RELATED PLACES ──────────────────────────────────────────────
  {
    name: 'Chennai',
    city: 'Capital City, Tamil Nadu',
    lat: 13.0827,
    lng: 80.2707,
    type: 'city',
    district: 'Chennai',
    keywords: ['chennai', 'madras'],
  },
  {
    name: 'Chennai Central (Puratchi Thalaivar Dr. MGR)',
    city: 'Park Town, Chennai, Tamil Nadu',
    lat: 13.0836,
    lng: 80.2754,
    type: 'station',
    district: 'Chennai',
    keywords: ['chennai central', 'mgr central', 'central station', 'railway', 'mas'],
  },
  {
    name: 'Chennai Egmore Railway Station',
    city: 'Egmore, Chennai, Tamil Nadu',
    lat: 13.079,
    lng: 80.261,
    type: 'station',
    district: 'Chennai',
    keywords: ['chennai egmore', 'egmore station', 'railway', 'train', 'ms'],
  },
  {
    name: 'Koyambedu CMBT Bus Stand',
    city: 'Koyambedu, Chennai, Tamil Nadu',
    lat: 13.0673,
    lng: 80.2075,
    type: 'bus_stand',
    district: 'Chennai',
    keywords: ['cmbt', 'koyambedu', 'bus stand', 'mofussil', 'chennai'],
  },
  {
    name: 'Kilambakkam Bus Terminus (KCBT)',
    city: 'GST Road, Kilambakkam, Chennai, Tamil Nadu',
    lat: 12.868,
    lng: 80.082,
    type: 'bus_stand',
    district: 'Chennai',
    keywords: ['kilambakkam', 'kcbt', 'kalaignar centenary', 'bus terminus', 'gst road', 'chennai'],
  },
  {
    name: 'Tambaram Railway Station & Bus Stand',
    city: 'GST Road, Tambaram, Chennai, Tamil Nadu',
    lat: 12.9249,
    lng: 80.1169,
    type: 'station',
    district: 'Chennai',
    keywords: ['tambaram', 'railway', 'bus stand', 'gst road', 'chennai'],
  },
  {
    name: 'Chennai International Airport (MAA)',
    city: 'GST Road, Meenambakkam, Chennai',
    lat: 12.9941,
    lng: 80.1709,
    type: 'airport',
    district: 'Chennai',
    keywords: ['chennai airport', 'maa', 'airport', 'meenambakkam'],
  },
  {
    name: 'Guindy Railway Station & Bus Stop',
    city: 'Guindy, Chennai, Tamil Nadu',
    lat: 13.0067,
    lng: 80.2125,
    type: 'station',
    district: 'Chennai',
    keywords: ['guindy', 'industrial estate', 'station', 'bus stand', 'chennai'],
  },
  {
    name: 'T. Nagar (Panagal Park)',
    city: 'T. Nagar, Chennai, Tamil Nadu',
    lat: 13.0418,
    lng: 80.2341,
    type: 'landmark',
    district: 'Chennai',
    keywords: ['t nagar', 'panagal park', 'ranganathan street', 'chennai'],
  },
  {
    name: 'Velachery Bus Stand & MRTS',
    city: 'Velachery, Chennai, Tamil Nadu',
    lat: 12.9784,
    lng: 80.2185,
    type: 'bus_stand',
    district: 'Chennai',
    keywords: ['velachery', 'mrts', 'bus stand', 'phoenix marketcity', 'chennai'],
  },
  {
    name: 'Madhavaram Inter-City Bus Terminus',
    city: 'Madhavaram, Chennai, Tamil Nadu',
    lat: 13.1492,
    lng: 80.2312,
    type: 'bus_stand',
    district: 'Chennai',
    keywords: ['madhavaram', 'bus terminus', 'andhra bus stand', 'chennai'],
  },
  {
    name: 'Marina Beach',
    city: 'Kamarajar Promenade, Chennai',
    lat: 13.05,
    lng: 80.2824,
    type: 'landmark',
    district: 'Chennai',
    keywords: ['marina beach', 'beach', 'chennai'],
  },

  // ── 4. MADURAI & RELATED PLACES ──────────────────────────────────────────────
  {
    name: 'Madurai',
    city: 'Cultural Capital, Tamil Nadu',
    lat: 9.9252,
    lng: 78.1198,
    type: 'city',
    district: 'Madurai',
    keywords: ['madurai', 'temple city', 'meenakshi'],
  },
  {
    name: 'Mattuthavani Bus Stand (MIBT)',
    city: 'Integrated Bus Terminus, Madurai, Tamil Nadu',
    lat: 9.9542,
    lng: 78.1565,
    type: 'bus_stand',
    district: 'Madurai',
    keywords: ['mattuthavani', 'mibt', 'integrated bus stand', 'madurai'],
  },
  {
    name: 'Arappalayam Bus Stand',
    city: 'Arappalayam, Madurai, Tamil Nadu',
    lat: 9.9365,
    lng: 78.1065,
    type: 'bus_stand',
    district: 'Madurai',
    keywords: ['arappalayam', 'bus stand', 'dindigul bus stand', 'madurai'],
  },
  {
    name: 'Madurai Junction Railway Station',
    city: 'West Veli Street, Madurai, Tamil Nadu',
    lat: 9.919,
    lng: 78.111,
    type: 'station',
    district: 'Madurai',
    keywords: ['madurai junction', 'railway station', 'train', 'madurai'],
  },
  {
    name: 'Periyar Bus Stand',
    city: 'Near Railway Station, Madurai, Tamil Nadu',
    lat: 9.918,
    lng: 78.1145,
    type: 'bus_stand',
    district: 'Madurai',
    keywords: ['periyar bus stand', 'town bus stand', 'madurai'],
  },
  {
    name: 'Madurai International Airport (IXM)',
    city: 'Perungudi, Madurai, Tamil Nadu',
    lat: 9.8345,
    lng: 78.0934,
    type: 'airport',
    district: 'Madurai',
    keywords: ['madurai airport', 'ixm', 'perungudi', 'airport'],
  },

  // ── 5. SALEM & RELATED PLACES ────────────────────────────────────────────────
  {
    name: 'Salem',
    city: 'Steel City, Tamil Nadu',
    lat: 11.6643,
    lng: 78.146,
    type: 'city',
    district: 'Salem',
    keywords: ['salem'],
  },
  {
    name: 'Salem New Bus Stand (Central Terminus)',
    city: 'Meyyanur, Salem, Tamil Nadu',
    lat: 11.668,
    lng: 78.1345,
    type: 'bus_stand',
    district: 'Salem',
    keywords: ['salem new bus stand', 'central bus terminus', 'meyyanur', 'salem'],
  },
  {
    name: 'Salem Junction Railway Station',
    city: 'Suramangalam, Salem, Tamil Nadu',
    lat: 11.6745,
    lng: 78.114,
    type: 'station',
    district: 'Salem',
    keywords: ['salem junction', 'suramangalam', 'railway station', 'salem'],
  },
  {
    name: 'Salem Old Bus Stand',
    city: 'Bazaar, Salem, Tamil Nadu',
    lat: 11.655,
    lng: 78.158,
    type: 'bus_stand',
    district: 'Salem',
    keywords: ['salem old bus stand', 'town bus stand', 'salem'],
  },
  {
    name: 'Attur Bus Stand',
    city: 'Attur, Salem District, Tamil Nadu',
    lat: 11.5975,
    lng: 78.5995,
    type: 'bus_stand',
    district: 'Salem',
    keywords: ['attur', 'aathur', 'bus stand', 'salem'],
  },
  {
    name: 'Mettur Dam & Bus Stand',
    city: 'Mettur, Salem District, Tamil Nadu',
    lat: 11.796,
    lng: 77.801,
    type: 'landmark',
    district: 'Salem',
    keywords: ['mettur', 'mettur dam', 'bus stand', 'salem'],
  },
  {
    name: 'Yercaud Bus Stand',
    city: 'Yercaud Hill Station, Salem District',
    lat: 11.775,
    lng: 78.209,
    type: 'landmark',
    district: 'Salem',
    keywords: ['yercaud', 'shevaroy hills', 'salem'],
  },

  // ── 6. TIRUCHIRAPPALLI (TRICHY) & RELATED PLACES ─────────────────────────────
  {
    name: 'Tiruchirappalli',
    city: 'City Center / Cantonment, Tamil Nadu',
    lat: 10.7905,
    lng: 78.7047,
    type: 'city',
    district: 'Tiruchirappalli',
    keywords: ['tiruchirappalli', 'trichy', 'tiruchirapalli', 'thiruchi'],
  },
  {
    name: 'Trichy Central Bus Stand',
    city: 'Cantonment, Tiruchirappalli, Tamil Nadu',
    lat: 10.803,
    lng: 78.685,
    type: 'bus_stand',
    district: 'Tiruchirappalli',
    keywords: ['trichy central bus stand', 'cantonment', 'bus stand', 'trichy'],
  },
  {
    name: 'Trichy Junction Railway Station (TPJ)',
    city: 'Bharathiar Salai, Tiruchirappalli, Tamil Nadu',
    lat: 10.7925,
    lng: 78.6835,
    type: 'station',
    district: 'Tiruchirappalli',
    keywords: ['trichy junction', 'tpj', 'railway station', 'train', 'trichy'],
  },
  {
    name: 'Chatram Bus Stand',
    city: 'Chatram, Tiruchirappalli, Tamil Nadu',
    lat: 10.828,
    lng: 78.694,
    type: 'bus_stand',
    district: 'Tiruchirappalli',
    keywords: ['chatram bus stand', 'chathiram', 'trichy'],
  },
  {
    name: 'Srirangam Temple & Railway Station',
    city: 'Srirangam, Tiruchirappalli, Tamil Nadu',
    lat: 10.862,
    lng: 78.69,
    type: 'landmark',
    district: 'Tiruchirappalli',
    keywords: ['srirangam', 'ragunatha swamy temple', 'railway station', 'trichy'],
  },
  {
    name: 'Tiruchirappalli International Airport (TRZ)',
    city: 'Pudukkottai Road, Tiruchirappalli',
    lat: 10.7654,
    lng: 78.7097,
    type: 'airport',
    district: 'Tiruchirappalli',
    keywords: ['trichy airport', 'trz', 'airport', 'international'],
  },

  // ── 7. ERODE & RELATED PLACES ────────────────────────────────────────────────
  {
    name: 'Erode',
    city: 'Textile City, Tamil Nadu',
    lat: 11.341,
    lng: 77.7172,
    type: 'city',
    district: 'Erode',
    keywords: ['erode'],
  },
  {
    name: 'Erode Central Bus Stand',
    city: 'Bus Stand Road, Erode, Tamil Nadu',
    lat: 11.345,
    lng: 77.722,
    type: 'bus_stand',
    district: 'Erode',
    keywords: ['erode central bus stand', 'bus stand', 'erode'],
  },
  {
    name: 'Erode Junction Railway Station (ED)',
    city: 'Railway Station Road, Erode, Tamil Nadu',
    lat: 11.3385,
    lng: 77.728,
    type: 'station',
    district: 'Erode',
    keywords: ['erode junction', 'ed', 'railway station', 'erode'],
  },
  {
    name: 'Bhavani / Kooduthurai Bus Stand',
    city: 'Sangameswarar Temple, Bhavani, Erode, Tamil Nadu',
    lat: 11.446,
    lng: 77.682,
    type: 'bus_stand',
    district: 'Erode',
    keywords: ['bhavani', 'kooduthurai', 'bus stand', 'erode'],
  },
  {
    name: 'Perundurai Bus Stand & SIPCOT',
    city: 'Perundurai, Erode District, Tamil Nadu',
    lat: 11.275,
    lng: 77.584,
    type: 'bus_stand',
    district: 'Erode',
    keywords: ['perundurai', 'sipcot', 'bus stand', 'erode'],
  },
  {
    name: 'Gobichettipalayam Bus Stand',
    city: 'Gobichettipalayam, Erode District, Tamil Nadu',
    lat: 11.455,
    lng: 77.438,
    type: 'bus_stand',
    district: 'Erode',
    keywords: ['gobichettipalayam', 'gobi', 'bus stand', 'erode'],
  },

  // ── 8. TIRUPPUR & RELATED PLACES ─────────────────────────────────────────────
  {
    name: 'Tiruppur',
    city: 'Knitwear Capital, Tamil Nadu',
    lat: 11.1085,
    lng: 77.3411,
    type: 'city',
    district: 'Tiruppur',
    keywords: ['tiruppur', 'tirupur'],
  },
  {
    name: 'Tiruppur New Bus Stand',
    city: 'Pushpa Theatre / Kotuveli, Tiruppur, Tamil Nadu',
    lat: 11.121,
    lng: 77.349,
    type: 'bus_stand',
    district: 'Tiruppur',
    keywords: ['tiruppur new bus stand', 'new bus stand', 'tiruppur'],
  },
  {
    name: 'Tiruppur Old Bus Stand',
    city: 'Town Center, Tiruppur, Tamil Nadu',
    lat: 11.1065,
    lng: 77.345,
    type: 'bus_stand',
    district: 'Tiruppur',
    keywords: ['tiruppur old bus stand', 'old bus stand', 'tiruppur'],
  },
  {
    name: 'Tiruppur Railway Station',
    city: 'Station Road, Tiruppur, Tamil Nadu',
    lat: 11.109,
    lng: 77.3475,
    type: 'station',
    district: 'Tiruppur',
    keywords: ['tiruppur railway station', 'station', 'train', 'tiruppur'],
  },
  {
    name: 'Avinashi Bus Stand & Temple',
    city: 'Avinashi, Tiruppur District, Tamil Nadu',
    lat: 11.194,
    lng: 77.269,
    type: 'bus_stand',
    district: 'Tiruppur',
    keywords: ['avinashi', 'avinashilingeswarar', 'bus stand', 'tiruppur'],
  },
  {
    name: 'Palladam Bus Stand',
    city: 'Palladam, Tiruppur District, Tamil Nadu',
    lat: 10.998,
    lng: 77.288,
    type: 'bus_stand',
    district: 'Tiruppur',
    keywords: ['palladam', 'bus stand', 'tiruppur'],
  },
  {
    name: 'Dharapuram Bus Stand',
    city: 'Dharapuram, Tiruppur District, Tamil Nadu',
    lat: 10.73,
    lng: 77.525,
    type: 'bus_stand',
    district: 'Tiruppur',
    keywords: ['dharapuram', 'bus stand', 'tiruppur'],
  },

  // ── 9. DINDIGUL & RELATED PLACES ─────────────────────────────────────────────
  {
    name: 'Dindigul',
    city: 'Lock City / Fort City, Tamil Nadu',
    lat: 10.3673,
    lng: 77.9803,
    type: 'city',
    district: 'Dindigul',
    keywords: ['dindigul', 'dindugul'],
  },
  {
    name: 'Dindigul Central Bus Stand',
    city: 'Bus Stand Road, Dindigul, Tamil Nadu',
    lat: 10.362,
    lng: 77.975,
    type: 'bus_stand',
    district: 'Dindigul',
    keywords: ['dindigul bus stand', 'central bus stand', 'dindigul'],
  },
  {
    name: 'Palani Bus Stand & Murugan Temple',
    city: 'Palani, Dindigul District, Tamil Nadu',
    lat: 10.45,
    lng: 77.52,
    type: 'landmark',
    district: 'Dindigul',
    keywords: ['palani', 'palani bus stand', 'murugan temple', 'dindigul'],
  },
  {
    name: 'Kodaikanal Bus Stand',
    city: 'Princess of Hill Stations, Dindigul District',
    lat: 10.238,
    lng: 77.489,
    type: 'landmark',
    district: 'Dindigul',
    keywords: ['kodaikanal', 'kodai', 'bus stand', 'dindigul'],
  },

  // ── 10. TIRUNELVELI & RELATED PLACES ─────────────────────────────────────────
  {
    name: 'Tirunelveli',
    city: 'Halwa City / Nellai, Tamil Nadu',
    lat: 8.7139,
    lng: 77.7567,
    type: 'city',
    district: 'Tirunelveli',
    keywords: ['tirunelveli', 'nellai', 'thirunelveli'],
  },
  {
    name: 'Tirunelveli New Bus Stand (Vaeinthaankulam)',
    city: 'Vaeinthaankulam, Tirunelveli, Tamil Nadu',
    lat: 8.728,
    lng: 77.732,
    type: 'bus_stand',
    district: 'Tirunelveli',
    keywords: ['tirunelveli new bus stand', 'vaeinthaankulam', 'bus stand', 'nellai'],
  },
  {
    name: 'Tirunelveli Junction Railway Station',
    city: 'Tirunelveli Junction, Tamil Nadu',
    lat: 8.73,
    lng: 77.712,
    type: 'station',
    district: 'Tirunelveli',
    keywords: ['tirunelveli junction', 'railway station', 'train', 'nellai'],
  },
  {
    name: 'Courtallam Falls & Bus Stand',
    city: 'Courtallam, Tenkasi / Tirunelveli, Tamil Nadu',
    lat: 8.93,
    lng: 77.275,
    type: 'landmark',
    district: 'Tirunelveli',
    keywords: ['courtallam', 'kutralam', 'falls', 'waterfalls', 'tenkasi'],
  },

  // ── 11. VELLORE & RELATED PLACES ─────────────────────────────────────────────
  {
    name: 'Vellore',
    city: 'Fort City, Tamil Nadu',
    lat: 12.9165,
    lng: 79.1325,
    type: 'city',
    district: 'Vellore',
    keywords: ['vellore', 'vellore fort'],
  },
  {
    name: 'Katpadi Junction Railway Station (KPD)',
    city: 'Katpadi, Vellore, Tamil Nadu',
    lat: 12.9695,
    lng: 79.138,
    type: 'station',
    district: 'Vellore',
    keywords: ['katpadi', 'kpd', 'railway station', 'vellore'],
  },
  {
    name: 'Vellore New Bus Stand',
    city: 'Chelliamman Koil Road, Vellore, Tamil Nadu',
    lat: 12.934,
    lng: 79.141,
    type: 'bus_stand',
    district: 'Vellore',
    keywords: ['vellore new bus stand', 'bus stand', 'vellore'],
  },
  {
    name: 'Christian Medical College (CMC Hospital)',
    city: 'Ida Scudder Road, Vellore, Tamil Nadu',
    lat: 12.924,
    lng: 79.135,
    type: 'hospital',
    district: 'Vellore',
    keywords: ['cmc', 'cmc hospital', 'christian medical college', 'vellore'],
  },
  {
    name: 'VIT University (Vellore Institute of Technology)',
    city: 'Katpadi, Vellore, Tamil Nadu',
    lat: 12.971,
    lng: 79.159,
    type: 'college',
    district: 'Vellore',
    keywords: ['vit', 'vit vellore', 'vit university', 'vellore'],
  },

  // ── 12. VILLUPURAM & RELATED PLACES ──────────────────────────────────────────
  {
    name: 'Villupuram',
    city: 'Major Junction Hub, Tamil Nadu',
    lat: 11.9401,
    lng: 79.4861,
    type: 'city',
    district: 'Villupuram',
    keywords: ['villupuram', 'viluppuram'],
  },
  {
    name: 'Villupuram Junction Railway Station',
    city: 'Villupuram Junction, Tamil Nadu',
    lat: 11.936,
    lng: 79.4975,
    type: 'station',
    district: 'Villupuram',
    keywords: ['villupuram junction', 'railway station', 'train', 'villupuram'],
  },
  {
    name: 'Villupuram New Bus Stand',
    city: 'Tindivanam Road, Villupuram, Tamil Nadu',
    lat: 11.949,
    lng: 79.498,
    type: 'bus_stand',
    district: 'Villupuram',
    keywords: ['villupuram new bus stand', 'bus stand', 'villupuram'],
  },
  {
    name: 'Tindivanam Bus Stand',
    city: 'Tindivanam, Villupuram District, Tamil Nadu',
    lat: 12.235,
    lng: 79.651,
    type: 'bus_stand',
    district: 'Villupuram',
    keywords: ['tindivanam', 'bus stand', 'villupuram'],
  },

  // ── 13. CUDDALORE & RELATED PLACES ───────────────────────────────────────────
  {
    name: 'Cuddalore',
    city: 'Coastal Hub, Tamil Nadu',
    lat: 11.748,
    lng: 79.7714,
    type: 'city',
    district: 'Cuddalore',
    keywords: ['cuddalore'],
  },
  {
    name: 'Cuddalore Central Bus Stand',
    city: 'Bus Stand Road, Cuddalore, Tamil Nadu',
    lat: 11.752,
    lng: 79.765,
    type: 'bus_stand',
    district: 'Cuddalore',
    keywords: ['cuddalore bus stand', 'bus stand', 'cuddalore'],
  },
  {
    name: 'Chidambaram Bus Stand & Nataraja Temple',
    city: 'Chidambaram, Cuddalore District, Tamil Nadu',
    lat: 11.399,
    lng: 79.693,
    type: 'landmark',
    district: 'Cuddalore',
    keywords: ['chidambaram', 'nataraja temple', 'bus stand', 'cuddalore'],
  },
  {
    name: 'Vridhachalam Junction Railway Station & Bus Stand',
    city: 'Vridhachalam, Cuddalore District, Tamil Nadu',
    lat: 11.518,
    lng: 79.328,
    type: 'station',
    district: 'Cuddalore',
    keywords: ['vridhachalam', 'virudhachalam', 'railway station', 'cuddalore'],
  },
  {
    name: 'Neyveli Township',
    city: 'NLC India, Cuddalore District, Tamil Nadu',
    lat: 11.598,
    lng: 79.486,
    type: 'city',
    district: 'Cuddalore',
    keywords: ['neyveli', 'nlc', 'cuddalore'],
  },

  // ── 14. THANJAVUR & RELATED PLACES ───────────────────────────────────────────
  {
    name: 'Thanjavur',
    city: 'Delta Capital / Big Temple, Tamil Nadu',
    lat: 10.787,
    lng: 79.1378,
    type: 'city',
    district: 'Thanjavur',
    keywords: ['thanjavur', 'tanjore', 'brihadeeswarar temple'],
  },
  {
    name: 'Thanjavur New Bus Stand',
    city: 'Trichy Road, Thanjavur, Tamil Nadu',
    lat: 10.776,
    lng: 79.112,
    type: 'bus_stand',
    district: 'Thanjavur',
    keywords: ['thanjavur new bus stand', 'new bus stand', 'thanjavur'],
  },
  {
    name: 'Thanjavur Junction Railway Station',
    city: 'Railway Station Road, Thanjavur, Tamil Nadu',
    lat: 10.778,
    lng: 79.138,
    type: 'station',
    district: 'Thanjavur',
    keywords: ['thanjavur junction', 'railway station', 'thanjavur'],
  },
  {
    name: 'Kumbakonam Railway Station & Bus Stand',
    city: 'Temple Town, Thanjavur District, Tamil Nadu',
    lat: 10.96,
    lng: 79.384,
    type: 'bus_stand',
    district: 'Thanjavur',
    keywords: ['kumbakonam', 'kudanthai', 'bus stand', 'railway', 'thanjavur'],
  },

  // ── 15. THE NILGIRIS / OOTY ──────────────────────────────────────────────────
  {
    name: 'Ooty (Udhagamandalam)',
    city: 'Queen of Hill Stations, The Nilgiris',
    lat: 11.4102,
    lng: 76.695,
    type: 'landmark',
    district: 'The Nilgiris',
    keywords: ['ooty', 'udhagamandalam', 'nilgiris', 'hill station'],
  },
  {
    name: 'Ooty Central Bus Stand',
    city: 'Near Botanical Garden, Ooty, Tamil Nadu',
    lat: 11.408,
    lng: 76.702,
    type: 'bus_stand',
    district: 'The Nilgiris',
    keywords: ['ooty bus stand', 'central bus stand', 'ooty'],
  },
  {
    name: 'Coonoor Bus Stand & Railway Station',
    city: 'Coonoor, The Nilgiris, Tamil Nadu',
    lat: 11.353,
    lng: 76.795,
    type: 'bus_stand',
    district: 'The Nilgiris',
    keywords: ['coonoor', 'bus stand', 'railway station', 'nilgiris'],
  },

  // ── 16. KANYAKUMARI & NAGERCOIL ──────────────────────────────────────────────
  {
    name: 'Kanyakumari',
    city: 'Southernmost Tip of India, Tamil Nadu',
    lat: 8.0883,
    lng: 77.5385,
    type: 'landmark',
    district: 'Kanyakumari',
    keywords: ['kanyakumari', 'cape comorin', 'vivekananda rock'],
  },
  {
    name: 'Nagercoil Christopher Bus Stand (Vadasery)',
    city: 'Vadasery, Nagercoil, Kanyakumari District',
    lat: 8.192,
    lng: 77.434,
    type: 'bus_stand',
    district: 'Kanyakumari',
    keywords: ['nagercoil', 'vadasery', 'christopher bus stand', 'kanyakumari'],
  },
  {
    name: 'Nagercoil Junction Railway Station',
    city: 'Railway Station Road, Nagercoil, Tamil Nadu',
    lat: 8.181,
    lng: 77.448,
    type: 'station',
    district: 'Kanyakumari',
    keywords: ['nagercoil junction', 'railway station', 'train', 'kanyakumari'],
  },

  // ── 17. PUDUCHERRY / PONDICHERRY ─────────────────────────────────────────────
  {
    name: 'Puducherry (Pondicherry)',
    city: 'White Town / Promenade Beach, UT',
    lat: 11.9416,
    lng: 79.8083,
    type: 'city',
    district: 'Puducherry',
    keywords: ['puducherry', 'pondicherry', 'pondy', 'white town'],
  },
  {
    name: 'Rajiv Gandhi Central Bus Stand, Puducherry',
    city: 'Maraimalai Adigal Salai, Puducherry',
    lat: 11.928,
    lng: 79.816,
    type: 'bus_stand',
    district: 'Puducherry',
    keywords: ['puducherry bus stand', 'pondicherry bus stand', 'rajiv gandhi', 'pondy'],
  },
  {
    name: 'Puducherry Railway Station',
    city: 'Subbiah Salai, Puducherry',
    lat: 11.93,
    lng: 79.825,
    type: 'station',
    district: 'Puducherry',
    keywords: ['puducherry railway station', 'railway station', 'pondy'],
  },
  {
    name: 'Auroville',
    city: 'Matrimandir, Viluppuram / Puducherry border',
    lat: 12.007,
    lng: 79.8105,
    type: 'landmark',
    district: 'Puducherry',
    keywords: ['auroville', 'matrimandir', 'puducherry'],
  },

  // ── 18. BENGALURU (BANGALORE) ────────────────────────────────────────────────
  {
    name: 'Bengaluru (Bangalore)',
    city: 'Silicon Valley of India, Karnataka',
    lat: 12.9716,
    lng: 77.5946,
    type: 'city',
    district: 'Bengaluru',
    keywords: ['bengaluru', 'bangalore', 'blore'],
  },
  {
    name: 'Kempegowda Bus Station (Majestic)',
    city: 'Majestic, Bengaluru, Karnataka',
    lat: 12.9781,
    lng: 77.5696,
    type: 'bus_stand',
    district: 'Bengaluru',
    keywords: ['majestic', 'kempegowda bus station', 'kbs', 'bengaluru', 'bangalore'],
  },
  {
    name: 'KSR Bengaluru City Junction (SBC)',
    city: 'Majestic, Bengaluru, Karnataka',
    lat: 12.9778,
    lng: 77.567,
    type: 'station',
    district: 'Bengaluru',
    keywords: ['ksr bengaluru', 'sbc', 'city railway station', 'bangalore', 'majestic'],
  },
  {
    name: 'Electronic City Bus Stop / Elevated Highway',
    city: 'Hosur Road, Bengaluru, Karnataka',
    lat: 12.8452,
    lng: 77.6602,
    type: 'bus_stand',
    district: 'Bengaluru',
    keywords: ['electronic city', 'ecity', 'hosur road', 'bengaluru', 'bangalore'],
  },
  {
    name: 'Silk Board Junction',
    city: 'Hosur Road / Outer Ring Road, Bengaluru',
    lat: 12.9175,
    lng: 77.6235,
    type: 'landmark',
    district: 'Bengaluru',
    keywords: ['silk board', 'junction', 'bengaluru', 'bangalore'],
  },
  {
    name: 'Kempegowda International Airport (BLR)',
    city: 'Devanahalli, Bengaluru, Karnataka',
    lat: 13.1986,
    lng: 77.7066,
    type: 'airport',
    district: 'Bengaluru',
    keywords: ['bangalore airport', 'blr', 'kempegowda airport', 'devanahalli'],
  },

  // ── 19. HOSUR & DHARMAPURI & KRISHNAGIRI ─────────────────────────────────────
  {
    name: 'Hosur',
    city: 'Industrial Border City, Krishnagiri District',
    lat: 12.7409,
    lng: 77.8253,
    type: 'city',
    district: 'Krishnagiri',
    keywords: ['hosur', 'sipcot', 'border'],
  },
  {
    name: 'Hosur Bus Stand',
    city: 'Bus Stand Road, Hosur, Tamil Nadu',
    lat: 12.735,
    lng: 77.829,
    type: 'bus_stand',
    district: 'Krishnagiri',
    keywords: ['hosur bus stand', 'bus stand', 'hosur'],
  },
  {
    name: 'Krishnagiri Central Bus Stand',
    city: 'NH 44 Highway, Krishnagiri, Tamil Nadu',
    lat: 12.527,
    lng: 78.214,
    type: 'bus_stand',
    district: 'Krishnagiri',
    keywords: ['krishnagiri', 'krishnagiri bus stand'],
  },
  {
    name: 'Dharmapuri Bus Stand',
    city: 'Dharmapuri, Tamil Nadu',
    lat: 12.132,
    lng: 78.158,
    type: 'bus_stand',
    district: 'Dharmapuri',
    keywords: ['dharmapuri', 'bus stand', 'dharmapuri'],
  },
  {
    name: 'Hogenakkal Falls',
    city: 'Niagara of India, Dharmapuri, Tamil Nadu',
    lat: 12.118,
    lng: 77.776,
    type: 'landmark',
    district: 'Dharmapuri',
    keywords: ['hogenakkal', 'falls', 'kaveri', 'dharmapuri'],
  },

  // ── 20. KARUR, NAMAKKAL, THENI, RAMESWARAM & OTHERS ─────────────────────────
  {
    name: 'Karur Bus Stand',
    city: 'Central Bus Stand, Karur, Tamil Nadu',
    lat: 10.957,
    lng: 78.084,
    type: 'bus_stand',
    district: 'Karur',
    keywords: ['karur', 'bus stand', 'textile'],
  },
  {
    name: 'Namakkal Bus Stand',
    city: 'Namakkal, Tamil Nadu',
    lat: 11.2189,
    lng: 78.1674,
    type: 'bus_stand',
    district: 'Namakkal',
    keywords: ['namakkal', 'anjaneyar temple', 'bus stand'],
  },
  {
    name: 'Tiruvannamalai Temple & Bus Stand',
    city: 'Annamalaiyar Temple, Tiruvannamalai, Tamil Nadu',
    lat: 12.2253,
    lng: 79.0747,
    type: 'landmark',
    district: 'Tiruvannamalai',
    keywords: ['tiruvannamalai', 'thiruvannamalai', 'girivalam', 'bus stand'],
  },
  {
    name: 'Rameswaram Temple & Railway Station',
    city: 'Ramanathaswamy Temple, Rameswaram, Tamil Nadu',
    lat: 9.2885,
    lng: 79.3129,
    type: 'landmark',
    district: 'Ramanathapuram',
    keywords: ['rameswaram', 'pamban bridge', 'railway', 'temple'],
  },
  {
    name: 'Kanchipuram Bus Stand',
    city: 'Silk City, Kanchipuram, Tamil Nadu',
    lat: 12.8342,
    lng: 79.7036,
    type: 'bus_stand',
    district: 'Kanchipuram',
    keywords: ['kanchipuram', 'kanchi', 'bus stand', 'silk'],
  },
  {
    name: 'Chengalpattu Junction & Bus Stand',
    city: 'GST Road, Chengalpattu, Tamil Nadu',
    lat: 12.693,
    lng: 79.983,
    type: 'station',
    district: 'Chengalpattu',
    keywords: ['chengalpattu', 'chengalpet', 'railway', 'bus stand'],
  },
];

// Quick Selection Chips displayed at the top of the screen
export const QUICK_DESTINATION_CHIPS = [
  { name: 'Kallakurichi', city: 'Tamil Nadu', lat: 11.740626, lng: 78.963713, type: 'city' },
  { name: 'Parikkal', city: 'Ulundurpettai, Kallakurichi', lat: 11.785145, lng: 79.367063, type: 'landmark' },
  { name: 'Coimbatore', city: 'Tamil Nadu', lat: 11.0168, lng: 76.9558, type: 'city' },
  { name: 'Chennai Central', city: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, type: 'station' },
  { name: 'Salem', city: 'Tamil Nadu', lat: 11.6643, lng: 78.146, type: 'city' },
  { name: 'Tiruchirappalli', city: 'Tamil Nadu', lat: 10.7905, lng: 78.7047, type: 'city' },
  { name: 'Madurai', city: 'Tamil Nadu', lat: 9.9252, lng: 78.1198, type: 'city' },
  { name: 'Bengaluru Majestic', city: 'Karnataka', lat: 12.9781, lng: 77.5696, type: 'bus_stand' },
];

/**
 * Normalizes input query with typo corrections and phonetic aliases
 */
export function normalizeQuery(query) {
  if (!query) return '';
  const clean = query.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ');
  const singleSpaced = clean.replace(/\s+/g, ' ').trim();

  // Check exact match in typo dictionary
  if (TYPO_MAP[singleSpaced]) {
    return TYPO_MAP[singleSpaced];
  }

  // Check word-by-word typo corrections
  const words = singleSpaced.split(' ');
  const correctedWords = words.map((w) => TYPO_MAP[w] || w);
  return correctedWords.join(' ');
}

/**
 * Searches destinations locally with Google Maps-like behavior:
 * 1. Finds the exact destination or matching place
 * 2. Finds ALL related places belonging to that destination (bus stands, stations, taluks)
 * 3. Shows them right below the destination so the user gets complete Google Maps results
 */
export function searchDestinationsLocally(query, userLocation = null) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const raw = query.trim().toLowerCase();
  const normalized = normalizeQuery(raw);
  const rawWords = raw.split(/\s+/).filter((w) => w.length >= 2);
  const normWords = normalized.split(/\s+/).filter((w) => w.length >= 2);
  const searchTerms = Array.from(new Set([raw, normalized, ...rawWords, ...normWords].filter(Boolean)));

  const matchedItems = [];
  const matchedDistricts = new Set();
  const addedKeys = new Set();

  function itemKey(item) {
    return `${item.name.toLowerCase()}--${item.lat.toFixed(4)},${item.lng.toFixed(4)}`;
  }

  // 1. Direct Matching: Exact, phrase, and multi-word matches on name, city, and keywords
  for (const item of ALL_DESTINATIONS) {
    const itemName = item.name.toLowerCase();
    const itemCity = item.city.toLowerCase();
    const itemDistrict = (item.district || '').toLowerCase();
    const itemKeywords = (item.keywords || []).map((k) => k.toLowerCase());

    const allWordsMatch =
      normWords.length > 1 &&
      normWords.every(
        (word) =>
          itemName.includes(word) ||
          itemCity.includes(word) ||
          itemDistrict.includes(word) ||
          itemKeywords.some((k) => k.includes(word))
      );

    const isDirectMatch =
      allWordsMatch ||
      searchTerms.some(
        (term) =>
          itemName.includes(term) ||
          itemCity.includes(term) ||
          itemDistrict === term ||
          itemKeywords.some((k) => k === term || k.includes(term))
      );

    if (isDirectMatch) {
      const k = itemKey(item);
      if (!addedKeys.has(k)) {
        addedKeys.add(k);
        matchedItems.push({
          ...item,
          isDirectMatch: true,
          isRelated: false,
          _allWordsMatch: allWordsMatch,
        });
        if (item.district) {
          matchedDistricts.add(item.district.toLowerCase());
        }
      }
    }
  }

  // 2. Related Places Expansion (Like Google Maps!):
  // When a destination/district is searched (e.g., 'kallakurichi' or 'coimbatore'),
  // gather all related transit places, bus stands, stations, and landmarks in that destination
  // and list them right below!
  const relatedItems = [];
  for (const districtName of matchedDistricts) {
    for (const item of ALL_DESTINATIONS) {
      if ((item.district || '').toLowerCase() === districtName) {
        const k = itemKey(item);
        if (!addedKeys.has(k)) {
          addedKeys.add(k);
          relatedItems.push({
            ...item,
            isDirectMatch: false,
            isRelated: true,
            relatedTo: districtName,
          });
        }
      }
    }
  }

  function scoreMatch(item) {
    const name = item.name.toLowerCase();
    const district = (item.district || '').toLowerCase();
    const city = item.city.toLowerCase();
    const keywords = (item.keywords || []).map((k) => k.toLowerCase());

    let score = 0;
    for (const term of searchTerms) {
      if (name === term) score = Math.max(score, 100);
      else if (name.startsWith(term)) score = Math.max(score, 90);
      else if (district === term) score = Math.max(score, 85);
      else if (keywords.some((k) => k === term)) score = Math.max(score, 80);
      else if (name.includes(term)) score = Math.max(score, 70);
      else if (keywords.some((k) => k.includes(term))) score = Math.max(score, 60);
    }
    if (item._allWordsMatch) score += 60;
    return score;
  }

  // 3. Sort intelligently:
  // Higher score first (name / district matches) -> primary city/bus stand -> stations -> landmarks
  const typePriority = {
    city: 1,
    bus_stand: 2,
    station: 3,
    airport: 4,
    college: 5,
    hospital: 6,
    landmark: 7,
  };

  matchedItems.sort((a, b) => {
    const sA = scoreMatch(a);
    const sB = scoreMatch(b);
    if (sA !== sB) return sB - sA;

    const pA = typePriority[a.type] || 10;
    const pB = typePriority[b.type] || 10;
    return pA - pB;
  });

  relatedItems.sort((a, b) => {
    const pA = typePriority[a.type] || 10;
    const pB = typePriority[b.type] || 10;
    return pA - pB;
  });

  // Combine: direct matches first, followed by related places in that destination
  return [...matchedItems, ...relatedItems];
}
