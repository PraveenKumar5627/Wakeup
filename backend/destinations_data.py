"""
destinations_data.py
Fast Python destination search engine for FastAPI backend.
Instant offline matching, typo tolerance, and related places expansion.
"""
from typing import List, Dict, Any, Optional
import urllib.request
import urllib.parse
import json
import concurrent.futures
import logging

TYPO_MAP = {
    "kallakuruchi": "kallakurichi",
    "kallakkurichi": "kallakurichi",
    "kallakurche": "kallakurichi",
    "kallakurchi": "kallakurichi",
    "kovai": "coimbatore",
    "cbe": "coimbatore",
    "cjb": "coimbatore",
    "coimbator": "coimbatore",
    "hopes": "hope college",
    "psg": "psg college of technology",
    "kct": "kumaraguru college of technology",
    "trichy": "tiruchirappalli",
    "tiruchirapalli": "tiruchirappalli",
    "cmbt": "koyambedu",
    "kcbt": "kilambakkam",
    "madras": "chennai",
    "salm": "salem",
    "madhurai": "madurai",
    "nellai": "tirunelveli",
    "pondy": "puducherry",
    "pondicherry": "puducherry",
    "bangalore": "bengaluru",
    "blore": "bengaluru",
    "ooty": "ooty",
    "katpadi": "katpadi",
    "chinnasalem": "chinnasalem",
    "ulundurpet": "ulundurpettai",
    "ulundurpettai": "ulundurpettai",
    "thiyagadurgam": "thiyagadurgam",
    "sankarapuram": "sankarapuram",
    "tirukoilur": "tirukoilur",
    "parikkal": "parikkal",
    "kumbakonam": "kumbakonam",
}

CURATED_PLACES = [
    # ── KALLAKURICHI & RELATED ──
    {
        "name": "Kallakurichi",
        "city": "District Headquarter, Tamil Nadu",
        "lat": 11.740626,
        "lng": 78.963713,
        "district": "Kallakurichi",
        "type": "city",
        "keywords": ["kallakurichi", "kallakuruchi", "town", "district"],
    },
    {
        "name": "Kallakurichi Bus Stand",
        "city": "Salem Main Road, Kallakurichi, Tamil Nadu",
        "lat": 11.7388,
        "lng": 78.9602,
        "district": "Kallakurichi",
        "type": "bus_stand",
        "keywords": ["kallakurichi", "kallakuruchi", "bus stand", "old bus stand"],
    },
    {
        "name": "TNSTC Bus Stand, Kallakurichi",
        "city": "Bus Stand Road, Kallakurichi, Tamil Nadu",
        "lat": 11.7392,
        "lng": 78.9610,
        "district": "Kallakurichi",
        "type": "bus_stand",
        "keywords": ["kallakurichi", "kallakuruchi", "tnstc", "depot"],
    },
    {
        "name": "Kallakurichi New Bus Stand",
        "city": "Salem-Chennai NH Highway, Kallakurichi, Tamil Nadu",
        "lat": 11.7445,
        "lng": 78.9675,
        "district": "Kallakurichi",
        "type": "bus_stand",
        "keywords": ["kallakurichi", "kallakuruchi", "new bus stand", "bypass"],
    },
    {
        "name": "Chinnasalem Railway Station",
        "city": "Chinnasalem, Kallakurichi, Tamil Nadu",
        "lat": 11.7225,
        "lng": 78.8812,
        "district": "Kallakurichi",
        "type": "station",
        "keywords": ["chinnasalem", "kallakurichi", "kallakuruchi", "railway"],
    },
    {
        "name": "Chinnasalem Bus Stand",
        "city": "Chinnasalem, Kallakurichi, Tamil Nadu",
        "lat": 11.7208,
        "lng": 78.8785,
        "district": "Kallakurichi",
        "type": "bus_stand",
        "keywords": ["chinnasalem", "kallakurichi", "kallakuruchi", "bus stand"],
    },
    {
        "name": "Ulundurpettai Bus Stand",
        "city": "Chennai-Trichy Highway, Ulundurpettai, Kallakurichi, Tamil Nadu",
        "lat": 11.6912,
        "lng": 79.2885,
        "district": "Kallakurichi",
        "type": "bus_stand",
        "keywords": ["ulundurpettai", "kallakurichi", "kallakuruchi", "bus stand"],
    },
    {
        "name": "Parikkal",
        "city": "Ulundurpettai, Kallakurichi, Tamil Nadu",
        "lat": 11.785145,
        "lng": 79.367063,
        "district": "Kallakurichi",
        "type": "landmark",
        "keywords": ["parikkal", "ulundurpettai", "kallakurichi", "kallakuruchi"],
    },
    {
        "name": "Sankarapuram Bus Stand",
        "city": "Sankarapuram, Kallakurichi, Tamil Nadu",
        "lat": 11.8860,
        "lng": 78.9180,
        "district": "Kallakurichi",
        "type": "bus_stand",
        "keywords": ["sankarapuram", "kallakurichi", "kallakuruchi", "bus stand"],
    },
    {
        "name": "Thiyagadurgam Bus Stand",
        "city": "Salem Main Road, Thiyagadurgam, Kallakurichi, Tamil Nadu",
        "lat": 11.7042,
        "lng": 79.0768,
        "district": "Kallakurichi",
        "type": "bus_stand",
        "keywords": ["thiyagadurgam", "kallakurichi", "kallakuruchi", "bus stand"],
    },
    {
        "name": "Tirukoilur Bus Stand",
        "city": "Tirukoilur, Kallakurichi, Tamil Nadu",
        "lat": 11.9615,
        "lng": 79.2045,
        "district": "Kallakurichi",
        "type": "bus_stand",
        "keywords": ["tirukoilur", "thirukoilur", "kallakurichi", "kallakuruchi", "bus stand"],
    },
    {
        "name": "Tirukoilur Railway Station",
        "city": "Tirukoilur, Kallakurichi, Tamil Nadu",
        "lat": 11.9580,
        "lng": 79.2110,
        "district": "Kallakurichi",
        "type": "station",
        "keywords": ["tirukoilur", "railway", "station", "kallakurichi"],
    },
    {
        "name": "Kallakurichi Govt Medical College & Hospital",
        "city": "Siruvangur Road, Kallakurichi, Tamil Nadu",
        "lat": 11.7480,
        "lng": 78.9710,
        "district": "Kallakurichi",
        "type": "hospital",
        "keywords": ["kallakurichi", "hospital", "medical college"],
    },
    {
        "name": "Kalvarayan Hills",
        "city": "Gomukhi Dam, Kallakurichi, Tamil Nadu",
        "lat": 11.8333,
        "lng": 78.7500,
        "district": "Kallakurichi",
        "type": "landmark",
        "keywords": ["kalvarayan", "hills", "kallakurichi"],
    },

    # ── COIMBATORE & RELATED ──
    {
        "name": "Coimbatore",
        "city": "City Center / Gandhipuram, Tamil Nadu",
        "lat": 11.0168,
        "lng": 76.9558,
        "district": "Coimbatore",
        "type": "city",
        "keywords": ["coimbatore", "kovai", "cbe"],
    },
    {
        "name": "Gandhipuram Central Bus Stand",
        "city": "Mofussil & SETC Bus Stand, Coimbatore, Tamil Nadu",
        "lat": 11.0183,
        "lng": 76.9678,
        "district": "Coimbatore",
        "type": "bus_stand",
        "keywords": ["gandhipuram", "central bus stand", "coimbatore", "setc"],
    },
    {
        "name": "Coimbatore Junction (Railway Station)",
        "city": "State Bank Road, Gopalapuram, Coimbatore",
        "lat": 10.9962,
        "lng": 76.9679,
        "district": "Coimbatore",
        "type": "station",
        "keywords": ["coimbatore junction", "railway station", "cbe"],
    },
    {
        "name": "Singanallur Bus Stand",
        "city": "Trichy Road, Singanallur, Coimbatore",
        "lat": 10.9997,
        "lng": 77.0272,
        "district": "Coimbatore",
        "type": "bus_stand",
        "keywords": ["singanallur", "trichy road", "bus stand", "coimbatore"],
    },
    {
        "name": "Ukkadam Bus Stand",
        "city": "Pollachi Main Road, Ukkadam, Coimbatore",
        "lat": 10.9880,
        "lng": 76.9610,
        "district": "Coimbatore",
        "type": "bus_stand",
        "keywords": ["ukkadam", "pollachi road", "bus stand", "coimbatore"],
    },
    {
        "name": "Hope College (Hopes)",
        "city": "Avinashi Road, Peelamedu, Coimbatore",
        "lat": 11.0258,
        "lng": 77.0166,
        "district": "Coimbatore",
        "type": "landmark",
        "keywords": ["hope college", "hopes", "peelamedu", "avinashi road", "coimbatore"],
    },
    {
        "name": "PSG College of Technology",
        "city": "Avinashi Road, Peelamedu, Coimbatore",
        "lat": 11.0247,
        "lng": 77.0028,
        "district": "Coimbatore",
        "type": "college",
        "keywords": ["psg", "psg tech", "peelamedu", "coimbatore"],
    },
    {
        "name": "Kumaraguru College of Technology (KCT)",
        "city": "Saravanampatti, Chinnavedampatti, Coimbatore",
        "lat": 11.0825,
        "lng": 76.9897,
        "district": "Coimbatore",
        "type": "college",
        "keywords": ["kct", "kumaraguru", "saravanampatti", "coimbatore"],
    },
    {
        "name": "Coimbatore International Airport (CJB)",
        "city": "Civil Aerodrome Post, Peelamedu, Coimbatore",
        "lat": 11.0300,
        "lng": 77.0434,
        "district": "Coimbatore",
        "type": "airport",
        "keywords": ["coimbatore airport", "cjb", "peelamedu"],
    },
    {
        "name": "Brookefields Mall",
        "city": "Dr Krishnasamy Road, Coimbatore",
        "lat": 11.0089,
        "lng": 76.9594,
        "district": "Coimbatore",
        "type": "landmark",
        "keywords": ["brookefields", "mall", "coimbatore"],
    },
    {
        "name": "Prozone Mall",
        "city": "Sathy Road, Saravanampatti, Coimbatore",
        "lat": 11.0545,
        "lng": 76.9940,
        "district": "Coimbatore",
        "type": "landmark",
        "keywords": ["prozone", "mall", "saravanampatti", "coimbatore"],
    },

    # ── CHENNAI & RELATED ──
    {
        "name": "Chennai",
        "city": "Capital City, Tamil Nadu",
        "lat": 13.0827,
        "lng": 80.2707,
        "district": "Chennai",
        "type": "city",
        "keywords": ["chennai", "madras"],
    },
    {
        "name": "Chennai Central (Puratchi Thalaivar Dr. MGR)",
        "city": "Park Town, Chennai, Tamil Nadu",
        "lat": 13.0836,
        "lng": 80.2754,
        "district": "Chennai",
        "type": "station",
        "keywords": ["chennai central", "mgr central", "central railway station", "mas"],
    },
    {
        "name": "Chennai Egmore Railway Station",
        "city": "Egmore, Chennai, Tamil Nadu",
        "lat": 13.0790,
        "lng": 80.2610,
        "district": "Chennai",
        "type": "station",
        "keywords": ["chennai egmore", "egmore", "railway station", "ms"],
    },
    {
        "name": "Koyambedu CMBT Bus Stand",
        "city": "Koyambedu, Chennai, Tamil Nadu",
        "lat": 13.0673,
        "lng": 80.2075,
        "district": "Chennai",
        "type": "bus_stand",
        "keywords": ["cmbt", "koyambedu", "bus stand", "chennai"],
    },
    {
        "name": "Kilambakkam Bus Terminus (KCBT)",
        "city": "GST Road, Kilambakkam, Chennai, Tamil Nadu",
        "lat": 12.8680,
        "lng": 80.0820,
        "district": "Chennai",
        "type": "bus_stand",
        "keywords": ["kilambakkam", "kcbt", "bus terminus", "gst road", "chennai"],
    },
    {
        "name": "Tambaram Railway Station & Bus Stand",
        "city": "GST Road, Tambaram, Chennai, Tamil Nadu",
        "lat": 12.9249,
        "lng": 80.1169,
        "district": "Chennai",
        "type": "station",
        "keywords": ["tambaram", "railway", "bus stand", "chennai"],
    },
    {
        "name": "Chennai International Airport (MAA)",
        "city": "GST Road, Meenambakkam, Chennai",
        "lat": 12.9941,
        "lng": 80.1709,
        "district": "Chennai",
        "type": "airport",
        "keywords": ["chennai airport", "maa", "airport", "meenambakkam"],
    },

    # ── SALEM & RELATED ──
    {
        "name": "Salem",
        "city": "Steel City, Tamil Nadu",
        "lat": 11.6643,
        "lng": 78.1460,
        "district": "Salem",
        "type": "city",
        "keywords": ["salem"],
    },
    {
        "name": "Salem New Bus Stand (Central Terminus)",
        "city": "Meyyanur, Salem, Tamil Nadu",
        "lat": 11.6680,
        "lng": 78.1345,
        "district": "Salem",
        "type": "bus_stand",
        "keywords": ["salem new bus stand", "central bus terminus", "meyyanur", "salem"],
    },
    {
        "name": "Salem Junction Railway Station",
        "city": "Suramangalam, Salem, Tamil Nadu",
        "lat": 11.6745,
        "lng": 78.1140,
        "district": "Salem",
        "type": "station",
        "keywords": ["salem junction", "suramangalam", "railway station", "salem"],
    },
    {
        "name": "Salem Old Bus Stand",
        "city": "Bazaar, Salem, Tamil Nadu",
        "lat": 11.6550,
        "lng": 78.1580,
        "district": "Salem",
        "type": "bus_stand",
        "keywords": ["salem old bus stand", "town bus stand", "salem"],
    },

    # ── MADURAI & RELATED ──
    {
        "name": "Madurai",
        "city": "Cultural Capital, Tamil Nadu",
        "lat": 9.9252,
        "lng": 78.1198,
        "district": "Madurai",
        "type": "city",
        "keywords": ["madurai", "temple city", "meenakshi"],
    },
    {
        "name": "Mattuthavani Bus Stand (MIBT)",
        "city": "Integrated Bus Terminus, Madurai, Tamil Nadu",
        "lat": 9.9542,
        "lng": 78.1565,
        "district": "Madurai",
        "type": "bus_stand",
        "keywords": ["mattuthavani", "mibt", "integrated bus stand", "madurai"],
    },
    {
        "name": "Madurai Junction Railway Station",
        "city": "West Veli Street, Madurai, Tamil Nadu",
        "lat": 9.9190,
        "lng": 78.1110,
        "district": "Madurai",
        "type": "station",
        "keywords": ["madurai junction", "railway station", "madurai"],
    },

    # ── TIRUCHIRAPPALLI (TRICHY) & RELATED ──
    {
        "name": "Tiruchirappalli",
        "city": "City Center / Cantonment, Tamil Nadu",
        "lat": 10.7905,
        "lng": 78.7047,
        "district": "Tiruchirappalli",
        "type": "city",
        "keywords": ["tiruchirappalli", "trichy", "thiruchi"],
    },
    {
        "name": "Trichy Central Bus Stand",
        "city": "Cantonment, Tiruchirappalli, Tamil Nadu",
        "lat": 10.8030,
        "lng": 78.6850,
        "district": "Tiruchirappalli",
        "type": "bus_stand",
        "keywords": ["trichy central bus stand", "cantonment", "bus stand", "trichy"],
    },
    {
        "name": "Trichy Junction Railway Station (TPJ)",
        "city": "Bharathiar Salai, Tiruchirappalli, Tamil Nadu",
        "lat": 10.7925,
        "lng": 78.6835,
        "district": "Tiruchirappalli",
        "type": "station",
        "keywords": ["trichy junction", "tpj", "railway station", "trichy"],
    },
]


def normalize_query(query: str) -> str:
    cleaned = query.strip().lower()
    return TYPO_MAP.get(cleaned, cleaned)


def search_curated_places(query: str, limit: int = 12) -> List[Dict[str, Any]]:
    raw = query.strip().lower()
    normalized = normalize_query(raw)
    terms = list(dict.fromkeys([t for t in [raw, normalized] if t]))

    matched = []
    matched_districts = set()
    added = set()

    for item in CURATED_PLACES:
        name_l = item["name"].lower()
        dist_l = item.get("district", "").lower()
        city_l = item.get("city", "").lower()
        kw_l = [k.lower() for k in item.get("keywords", [])]

        is_match = any(
            t in name_l or dist_l == t or any(t in k for k in kw_l) or t in city_l
            for t in terms
        )
        if is_match:
            key = (round(item["lat"], 4), round(item["lng"], 4))
            if key not in added:
                added.add(key)
                matched.append(item)
                if item.get("district"):
                    matched_districts.add(item["district"].lower())

    # Include related places under matched districts (like Google Maps)
    related = []
    for d in matched_districts:
        for item in CURATED_PLACES:
            if item.get("district", "").lower() == d:
                key = (round(item["lat"], 4), round(item["lng"], 4))
                if key not in added:
                    added.add(key)
                    related.append(item)

    # Sort: exact name match > starts with > city type > bus stand > others
    def sort_key(x):
        n = x["name"].lower()
        exact = any(n == t for t in terms)
        starts = any(n.startswith(t) for t in terms)
        t_order = {"city": 1, "bus_stand": 2, "station": 3, "landmark": 4, "hospital": 5, "college": 6}.get(x.get("type", ""), 10)
        return (not exact, not starts, t_order)

    matched.sort(key=sort_key)
    related.sort(key=sort_key)
    return (matched + related)[:limit]
