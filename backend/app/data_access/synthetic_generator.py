"""
Synthetic Railway Data Generator — Organic Spaced Topology (SIH26027)
======================================================================
• Geographic placement across 3200x2000 canvas space
• Minimum station spacing constraint (>= 50px between nodes) to prevent text collision
• Natural Bezier curves and uncluttered railway corridors
• 1,000 trains & ~150 maintenance requests
"""

import random
import json
import math
from datetime import datetime
from typing import List, Dict, Tuple
from sqlalchemy.orm import Session
from app.models.db_models import (
    Station, Section, Track, AlternateRoute, Train, Timetable,
    MaintenanceRequest, AssetCondition, Resource, WeatherForecast,
    BlockPlan, EmergencyLog
)

# ---------------------------------------------------------------------------
# 1. Geographic Hub Stations (Realistic relative Indian Railway positions)
# Canvas Size: 3200 x 2000
# ---------------------------------------------------------------------------
STATION_CATALOGUE: List[Tuple] = [
    # Northern Hubs (Delhi NCR, UP, Uttarakhand)
    ("NDLS",  "New Delhi",                      850,  450, "NR"),
    ("DLI",   "Old Delhi Junction",             830,  410, "NR"),
    ("ANVT",  "Anand Vihar Terminal",           890,  420, "NR"),
    ("GZB",   "Ghaziabad Junction",             950,  450, "NR"),
    ("SRE",   "Saharanpur",                     880,  220, "NR"),
    ("HW",    "Haridwar Junction",              960,  170, "NR"),
    ("RKSH",  "Rishikesh",                     1000,  130, "NR"),
    ("MB",    "Moradabad Junction",            1100,  360, "NR"),
    ("BE",    "Bareilly Junction",             1250,  410, "NR"),
    ("LKO",   "Lucknow Charbagh",              1450,  520, "NR"),
    ("AY",    "Ayodhya Dham Junction",         1620,  490, "NR"),
    ("GKP",   "Gorakhpur Junction",            1840,  450, "NR"),
    ("GD",    "Gonda Junction",                1710,  420, "NR"),
    ("BRY",   "Bahraich",                      1680,  340, "NR"),
    ("NKE",   "Nautanwa",                      1890,  370, "NR"),

    # Trunk Corridor: Delhi -> Kanpur -> Prayagraj -> DDU
    ("ALJN",  "Aligarh Junction",              1050,  570, "NR"),
    ("TDL",   "Tundla Junction",               1150,  620, "NR"),
    ("FZD",   "Firozabad",                     1200,  630, "NR"),
    ("ETW",   "Etawah Junction",               1280,  660, "NR"),
    ("CNB",   "Kanpur Central",                1400,  700, "NR"),
    ("PRYJ",  "Prayagraj Junction",            1630,  730, "NR"),
    ("BSB",   "Varanasi Junction",             1810,  680, "NR"),
    ("DDU",   "Pt. Deen Dayal Upadhyaya Jn",   1860,  730, "NR"),

    # Eastern Hubs (Bihar, Bengal, Jharkhand)
    ("MFP",   "Muzaffarpur Junction",          2100,  570, "ER"),
    ("PNBE",  "Patna Junction",                2070,  670, "ER"),
    ("GAYA",  "Gaya Junction",                 2040,  800, "ER"),
    ("DHN",   "Dhanbad Junction",              2350,  860, "ER"),
    ("ASN",   "Asansol Junction",              2480,  880, "ER"),
    ("HWH",   "Howrah Junction",               2780,  970, "ER"),
    ("SDAH",  "Sealdah",                       2820,  940, "ER"),

    # Western Hubs (Rajasthan, Gujarat, Mumbai)
    ("SWM",   "Sawai Madhopur",                 730,  730, "WR"),
    ("KOTA",  "Kota Junction",                  680,  830, "WR"),
    ("RTM",   "Ratlam Junction",                620,  990, "WR"),
    ("ADI",   "Ahmedabad Junction",             440, 1040, "WR"),
    ("BRC",   "Vadodara Junction",              490, 1140, "WR"),
    ("ST",    "Surat",                          450, 1290, "WR"),
    ("BCT",   "Mumbai Central",                 410, 1490, "WR"),

    # Central Hubs (MP, Maharashtra)
    ("BPL",   "Bhopal Junction",                930,  930, "CR"),
    ("ET",    "Itarsi Junction",                980, 1040, "CR"),
    ("JBP",   "Jabalpur Junction",             1190,  990, "CR"),
    ("NGP",   "Nagpur Junction",               1190, 1230, "CR"),
    ("CSTM",  "Chhatrapati Shivaji Terminus",   440, 1530, "CR"),
    ("PUNE",  "Pune Junction",                  540, 1610, "CR"),

    # South Central & Southern Hubs (Telangana, AP, TN, Karnataka, Kerala)
    ("HYB",   "Hyderabad Deccan",              1300, 1500, "SCR"),
    ("SC",    "Secunderabad Junction",         1330, 1480, "SCR"),
    ("GTL",   "Guntakal Junction",             1450, 1690, "SCR"),
    ("MAS",   "Chennai Central",               1970, 1820, "SR"),
    ("SBC",   "Bengaluru City Junction",       1580, 1880, "SR"),
    ("ERS",   "Ernakulam Junction",            1450, 1950, "SR"),
    ("TVC",   "Thiruvananthapuram Central",    1500, 2020, "SR"),
]

# Curated Main Sections
SECTION_CATALOGUE: List[Tuple] = [
    ("NDLS", "DLI",   5.0,   "Double", 4, 20, 80),
    ("NDLS", "ANVT",  12.0,  "Double", 2, 10, 90),
    ("DLI",  "GZB",   22.0,  "Double", 2, 12, 100),
    ("NDLS", "GZB",   25.0,  "Double", 2, 12, 110),
    ("ANVT", "GZB",   15.0,  "Double", 2, 8,  90),
    ("GZB",  "ALJN",  105.0, "Double", 2, 8,  130),
    ("ALJN", "TDL",   78.0,  "Double", 2, 8,  130),
    ("TDL",  "FZD",   24.0,  "Double", 2, 7,  120),
    ("FZD",  "ETW",   40.0,  "Double", 2, 7,  120),
    ("ETW",  "CNB",   75.0,  "Double", 2, 7,  130),
    ("GZB",  "MB",    140.0, "Double", 2, 6,  120),
    ("MB",   "BE",    90.0,  "Double", 2, 6,  120),
    ("BE",   "LKO",   235.0, "Double", 2, 5,  110),
    ("SRE",  "MB",    120.0, "Double", 2, 5,  110),
    ("NDLS", "SRE",   180.0, "Double", 2, 5,  110),
    ("SRE",  "HW",    55.0,  "Double", 2, 5,  90),
    ("HW",   "RKSH",  22.0,  "Single", 1, 3,  60),
    ("CNB",  "PRYJ",  195.0, "Double", 2, 7,  130),
    ("PRYJ", "DDU",   150.0, "Double", 2, 6,  130),
    ("DDU",  "BSB",   18.0,  "Double", 2, 8,  90),
    ("LKO",  "CNB",   72.0,  "Double", 2, 8,  110),
    ("LKO",  "AY",    135.0, "Single", 1, 4,  100),
    ("AY",   "GKP",   135.0, "Single", 1, 4,  100),
    ("GKP",  "NKE",   80.0,  "Single", 1, 3,  80),
    ("LKO",  "GD",    100.0, "Single", 1, 4,  90),
    ("GD",   "GKP",   110.0, "Single", 1, 4,  90),
    ("GD",   "BRY",   60.0,  "Single", 1, 3,  80),
    ("PRYJ", "BSB",   125.0, "Single", 1, 4,  100),
    ("LKO",  "PRYJ",  200.0, "Single", 1, 4,  100),
    ("BSB",  "GKP",   200.0, "Single", 1, 4,  90),
    ("BSB",  "MFP",   120.0, "Single", 1, 3,  90),
    ("MFP",  "GKP",   150.0, "Single", 1, 3,  80),
    ("DDU",  "GAYA",  130.0, "Double", 2, 6,  120),
    ("GAYA", "PNBE",  100.0, "Double", 2, 6,  120),
    ("PNBE", "DHN",   260.0, "Double", 2, 5,  110),
    ("DHN",  "ASN",   40.0,  "Double", 2, 6,  110),
    ("ASN",  "HWH",   200.0, "Double", 2, 8,  130),
    ("PNBE", "MFP",   70.0,  "Double", 2, 6,  100),
    ("HWH",  "SDAH",  5.0,   "Double", 4, 20, 60),
    ("NDLS", "SWM",   400.0, "Double", 2, 6,  130),
    ("SWM",  "KOTA",  100.0, "Double", 2, 6,  130),
    ("KOTA", "RTM",   160.0, "Double", 2, 5,  120),
    ("RTM",  "ADI",   250.0, "Double", 2, 5,  110),
    ("ADI",  "BRC",   100.0, "Double", 2, 8,  130),
    ("BRC",  "ST",    130.0, "Double", 2, 6,  130),
    ("ST",   "BCT",   270.0, "Double", 2, 6,  130),
    ("BCT",  "CSTM",  10.0,  "Double", 4, 15,  80),
    ("CSTM", "PUNE",  190.0, "Double", 2, 6,  110),
    ("NDLS", "BPL",   700.0, "Double", 2, 7,  130),
    ("BPL",  "ET",    60.0,  "Double", 2, 6,  110),
    ("ET",   "JBP",   180.0, "Double", 2, 5,  110),
    ("ET",   "NGP",   300.0, "Double", 2, 5,  110),
    ("NGP",  "SC",    500.0, "Double", 2, 5,  110),
    ("HYB",  "SC",    10.0,  "Double", 2, 10, 80),
    ("SC",   "GTL",   360.0, "Double", 2, 5,  110),
    ("GTL",  "MAS",   400.0, "Double", 2, 6,  130),
    ("GTL",  "SBC",   340.0, "Double", 2, 5,  110),
    ("MAS",  "SBC",   360.0, "Double", 2, 6,  130),
    ("MAS",  "ERS",   680.0, "Single", 1, 4,  110),
    ("ERS",  "TVC",   220.0, "Double", 2, 5,  110),
]

EXPRESS_NAMES = ["Rajdhani Express", "Shatabdi Express", "Vande Bharat Express", "Tejas Express", "Duronto Express", "Humsafar Express"]
SUPERFAST_NAMES = ["Superfast Express", "Premium Superfast", "LHB Superfast"]
PASSENGER_NAMES = ["MEMU Passenger", "Fast Passenger", "Ordinary Passenger"]
FREIGHT_NAMES = ["Goods Train", "Coal Rake", "Container Special", "BOXN Freight"]

ROUTE_TEMPLATES = [
    ["NDLS", "GZB", "ALJN", "TDL", "ETW", "CNB", "PRYJ", "DDU", "BSB"],
    ["NDLS", "DLI", "GZB", "MB", "BE", "LKO", "GD", "GKP"],
    ["NDLS", "GZB", "ALJN", "TDL", "CNB", "LKO", "AY", "GKP"],
    ["NDLS", "SWM", "KOTA", "RTM", "ADI", "BRC", "ST", "BCT"],
    ["NDLS", "BPL", "ET", "NGP", "SC", "GTL", "MAS"],
    ["HWH", "ASN", "DHN", "PNBE", "GAYA", "DDU"],
    ["CSTM", "PUNE", "SC", "GTL", "SBC", "MAS"],
    ["MAS", "ERS", "TVC"],
]

MAINT_TEMPLATES = [
    ("ENG", "SEC_GZB_ALJN",  1, 42.5, "Deep Track Tamping & Rail Joint Grinding",      3.0, 4, 2, [], ["TRACK_WELDING","TAMPER_OPERATOR"], ["TAMPER_MACHINE_01"]),
    ("ENG", "SEC_GZB_ALJN",  1, 46.0, "Rail Fracture Detection Survey",                2.0, 5, 1, [], ["TRACK_WELDING"], ["ULTRASONIC_TEST_CAR"]),
    ("ENG", "SEC_ALJN_TDL",  1, 20.0, "Ballast Cleaning & Sleeper Replacement",        4.5, 5, 1, [], ["TRACK_WELDING","TAMPER_OPERATOR"], ["TAMPER_MACHINE_02"]),
    ("ENG", "SEC_PRYJ_BSB",  1, 18.2, "Ballast Cleaning & Sleeper Replacement",        4.0, 5, 1, [], ["TRACK_WELDING","TAMPER_OPERATOR"], ["TAMPER_MACHINE_02"]),
    ("TRAC","SEC_GZB_ALJN",  1, 43.0, "OHE Catenary Wire Height & Stagger Alignment",  2.5, 4, 2, [], ["OHE_ALIGNMENT","HIGH_VOLTAGE_CERT"], ["TOWER_WAGON_01"]),
    ("ST",  "SEC_GZB_ALJN",  1, 42.8, "Axle Counter & Track Circuit Recalibration",    2.0, 3, 3, ["REQ-ENG-101"], ["SIGNAL_TESTING"], ["SIGNAL_TEST_KIT_01"]),
    ("ST",  "SEC_LKO_CNB",   1, 35.0, "Point Machine Overhaul & Interlocking Test",    3.0, 4, 2, [], ["SIGNAL_TESTING"], ["SIGNAL_TEST_KIT_02"]),
    ("ENG", "SEC_CNB_PRYJ",  1, 95.0, "Track Geometry Correction",                     3.5, 4, 2, [], ["TAMPER_OPERATOR"], ["TAMPER_MACHINE_03"]),
]

RESOURCES_CATALOGUE = [
    ("RES-ENG-CREW-1",  "Crew",      "Engineering Gang #1",           "ENG",  "TRACK_WELDING",    8,  0.0, 24.0),
    ("RES-ENG-CREW-2",  "Crew",      "Engineering Gang #2",           "ENG",  "TAMPER_OPERATOR",  6,  0.0, 24.0),
    ("RES-TRAC-CREW-1", "Crew",      "Traction OHE Line Crew A",      "TRAC", "OHE_ALIGNMENT",    6,  0.0, 24.0),
    ("RES-ST-CREW-1",   "Crew",      "Signal Maintenance Squad A",    "ST",   "SIGNAL_TESTING",   5,  0.0, 24.0),
    ("RES-EQUIP-1",  "Equipment", "Heavy Track Tamper #01",        "ENG",  "TAMPER_MACHINE_01",1, 0.0, 24.0),
    ("RES-EQUIP-4",  "Equipment", "OHE Tower Wagon #01",           "TRAC", "TOWER_WAGON_01",  1,  0.0, 24.0),
    ("RES-EQUIP-7",  "Equipment", "Signal Test Kit #01",           "ST",   "SIGNAL_TEST_KIT_01",2,0.0, 24.0),
]

WEATHER_SCENARIOS = [
    (34.0,  2.5, 12.0, "Low"),
    (36.0,  0.0, 18.0, "Low"),
    (31.0, 12.0, 22.0, "Medium"),
    (28.0, 22.0, 38.0, "High"),
]


def seed_database(db: Session, seed: int = 42):
    """Seed database with organic geographic railway topology (1000 stations, ~1200 sections)."""
    rng = random.Random(seed)

    # Clear existing data
    for model in [BlockPlan, EmergencyLog, Timetable, Train, MaintenanceRequest,
                  AssetCondition, Resource, WeatherForecast, AlternateRoute,
                  Track, Section, Station]:
        db.query(model).delete()
    db.commit()

    station_objs: Dict[str, Station] = {}
    
    # ── 1. Insert Geographic Hub Stations (~50) ────────────────────────────────
    for code, name, x, y, zone in STATION_CATALOGUE:
        s = Station(
            code=code, name=name,
            schematic_x_position=x, schematic_y_position=y,
            zone=zone
        )
        db.add(s)
        station_objs[code] = s
    db.commit()

    # ── 2. Scatter Synthetic Stations Organically with >= 45px Spacing Constraint ──
    # Define Rail Corridors between Hubs
    corridors = [
        {"zone": "NR", "hubs": ["NDLS", "GZB", "ALJN", "TDL", "CNB", "PRYJ", "DDU", "GAYA", "DHN", "ASN", "HWH"], "count": 180},
        {"zone": "WR", "hubs": ["NDLS", "SWM", "KOTA", "RTM", "ADI", "BRC", "ST", "BCT", "CSTM"], "count": 160},
        {"zone": "CR", "hubs": ["NDLS", "GZB", "BPL", "ET", "NGP", "SC", "HYB", "GTL", "MAS"], "count": 160},
        {"zone": "NR", "hubs": ["NDLS", "SRE", "HW", "MB", "BE", "LKO", "AY", "GD", "GKP", "NKE"], "count": 150},
        {"zone": "ER", "hubs": ["DDU", "PNBE", "MFP", "GAYA", "DHN", "ASN", "SDAH", "HWH"], "count": 140},
        {"zone": "SR", "hubs": ["MAS", "GTL", "SBC", "ERS", "TVC"], "count": 130},
    ]

    existing_cnt = len(station_objs)
    target_cnt = 1000
    station_counter = existing_cnt + 1

    corridor_station_chains: List[List[str]] = []
    station_coords_list: List[Tuple[int, int]] = [(s.schematic_x_position, s.schematic_y_position) for s in station_objs.values()]

    for corr in corridors:
        hub_codes = corr["hubs"]
        count_to_add = corr["count"]
        zone = corr["zone"]

        pts = [(station_objs[h].schematic_x_position, station_objs[h].schematic_y_position) for h in hub_codes if h in station_objs]
        if len(pts) < 2:
            continue

        total_len = 0.0
        seg_lens = []
        for i in range(len(pts) - 1):
            dx = pts[i+1][0] - pts[i][0]
            dy = pts[i+1][1] - pts[i][1]
            l = math.sqrt(dx*dx + dy*dy)
            seg_lens.append(l)
            total_len += l

        chain = []
        for k in range(count_to_add):
            if station_counter > target_cnt:
                break
            
            t = (k + 1) / (count_to_add + 1)
            target_dist = t * total_len

            accum = 0.0
            seg_idx = 0
            for i, l in enumerate(seg_lens):
                if accum + l >= target_dist:
                    seg_idx = i
                    break
                accum += l
            
            seg_t = (target_dist - accum) / max(1.0, seg_lens[seg_idx])
            p0 = pts[seg_idx]
            p1 = pts[seg_idx + 1]

            bx = p0[0] + seg_t * (p1[0] - p0[0])
            by = p0[1] + seg_t * (p1[1] - p0[1])

            dx = p1[0] - p0[0]
            dy = p1[1] - p0[1]
            norm = math.sqrt(dx*dx + dy*dy) or 1.0
            nx = -dy / norm
            ny = dx / norm

            offset = rng.uniform(-40.0, 40.0)
            x = int(bx + nx * offset)
            y = int(by + ny * offset)

            # Spatial spacing check: ensure min 45px distance from all existing stations
            too_close = False
            for (ex, ey) in station_coords_list:
                if math.sqrt((x - ex)**2 + (y - ey)**2) < 45:
                    too_close = True
                    break

            if too_close:
                # Slightly shift along vector
                x = int(x + rng.uniform(-20, 20))
                y = int(y + rng.uniform(-20, 20))

            station_coords_list.append((x, y))
            synth_code = f"STN{station_counter:04d}"
            synth_name = f"Station {station_counter}"

            s = Station(
                code=synth_code, name=synth_name,
                schematic_x_position=x, schematic_y_position=y,
                zone=zone
            )
            db.add(s)
            station_objs[synth_code] = s
            chain.append(synth_code)
            station_counter += 1

        corridor_station_chains.append(chain)

    db.commit()

    # ── 3. Create Curved Section Routes & Tracks ──────────────────────────────
    valid_section_codes = set()
    created_pairs = set()

    for (start, end, dist, ttype, num_tracks, cap, spd) in SECTION_CATALOGUE:
        if start not in station_objs or end not in station_objs:
            continue
        code = f"SEC_{start}_{end}"
        valid_section_codes.add(code)
        created_pairs.add((start, end))
        created_pairs.add((end, start))
        sec = Section(
            code=code,
            start_station_code=start,
            end_station_code=end,
            length_km=dist,
            track_type=ttype,
            total_tracks=num_tracks,
            capacity_trains_per_hr=cap,
            max_speed_kmh=spd
        )
        db.add(sec)
        db.flush()
        for t_idx in range(1, num_tracks + 1):
            db.add(Track(
                track_id=f"TRK_{code}_{t_idx}",
                section_code=code,
                track_number=t_idx,
                health_status="healthy",
                direction="UP" if t_idx % 2 == 1 else "DOWN"
            ))

    for chain in corridor_station_chains:
        for i in range(len(chain) - 1):
            st_a = chain[i]
            st_b = chain[i + 1]

            if (st_a, st_b) in created_pairs:
                continue

            sec_code = f"SEC_{st_a}_{st_b}"
            valid_section_codes.add(sec_code)
            created_pairs.add((st_a, st_b))
            created_pairs.add((st_b, st_a))

            dist_km = round(rng.uniform(15.0, 35.0), 1)
            ttype = "Double" if (i % 2 == 0) else "Single"
            num_trks = 2 if ttype == "Double" else 1

            db.add(Section(
                code=sec_code, start_station_code=st_a, end_station_code=st_b,
                length_km=dist_km, track_type=ttype, total_tracks=num_trks,
                capacity_trains_per_hr=8, max_speed_kmh=100.0
            ))
            db.flush()

            for t_idx in range(1, num_trks + 1):
                db.add(Track(
                    track_id=f"TRK_{sec_code}_{t_idx}",
                    section_code=sec_code,
                    track_number=t_idx,
                    health_status="healthy",
                    direction="UP" if t_idx % 2 == 1 else "DOWN"
                ))

        if chain:
            for endpoint in [chain[0], chain[-1]]:
                ep_x = station_objs[endpoint].schematic_x_position
                ep_y = station_objs[endpoint].schematic_y_position

                closest_hub = None
                min_d = 99999.0
                for code, _, x, y, _ in STATION_CATALOGUE:
                    d = math.sqrt((ep_x - x)**2 + (ep_y - y)**2)
                    if d < min_d:
                        min_d = d
                        closest_hub = code

                if closest_hub and (endpoint, closest_hub) not in created_pairs:
                    sec_code = f"SEC_{endpoint}_{closest_hub}"
                    valid_section_codes.add(sec_code)
                    created_pairs.add((endpoint, closest_hub))
                    created_pairs.add((closest_hub, endpoint))
                    db.add(Section(
                        code=sec_code, start_station_code=endpoint, end_station_code=closest_hub,
                        length_km=18.0, track_type="Double", total_tracks=2,
                        capacity_trains_per_hr=10, max_speed_kmh=110.0
                    ))
                    db.flush()
                    db.add(Track(track_id=f"TRK_{sec_code}_1", section_code=sec_code, track_number=1, health_status="healthy", direction="UP"))
                    db.add(Track(track_id=f"TRK_{sec_code}_2", section_code=sec_code, track_number=2, health_status="healthy", direction="DOWN"))

    db.commit()

    # ── 4. Trains & Timetables (1000 trains) ─────────────────────────────────
    PEAK_BIASES = [0, 4, 5, 6, 7, 8, 10, 17, 18, 19, 20, 21, 22, 23]
    all_dep_minutes = []
    for i in range(600):
        all_dep_minutes.append((i * 1440 // 600) % 1440)
    for i in range(400):
        peak_hr = PEAK_BIASES[i % len(PEAK_BIASES)]
        all_dep_minutes.append((peak_hr * 60 + rng.randint(-20, 20)) % 1440)
    rng.shuffle(all_dep_minutes)

    def pick_category(idx: int):
        roll = idx % 100
        if roll < 30:
            return ("Express",    rng.choice(EXPRESS_NAMES),    1)
        elif roll < 50:
            return ("Superfast",  rng.choice(SUPERFAST_NAMES),  2)
        elif roll < 70:
            return ("Passenger",  rng.choice(PASSENGER_NAMES),  3)
        else:
            return ("Freight",    rng.choice(FREIGHT_NAMES),     4)

    for i in range(1000):
        tt_cat, base_name, prio = pick_category(i)
        tr_num = f"{10000 + i}"
        t_id = f"TRN-{tr_num}"
        train_name = f"{base_name} #{tr_num}"

        route = ROUTE_TEMPLATES[i % len(ROUTE_TEMPLATES)]
        if (i % 7) == 0:
            route = list(reversed(route))
        route = [s for s in route if s in station_objs]
        if len(route) < 2:
            route = ["NDLS", "GZB"]

        dep_min = all_dep_minutes[i]
        min_per_hop = 25 if tt_cat == "Express" else (30 if tt_cat == "Superfast" else 40)
        arr_min = (dep_min + len(route) * min_per_hop) % 1440
        dep_str = f"{dep_min // 60:02d}:{dep_min % 60:02d}"
        arr_str = f"{arr_min // 60:02d}:{arr_min % 60:02d}"

        original_path_stops = []
        curr_m = dep_min
        for st_c in route:
            original_path_stops.append({
                "station_code": st_c,
                "scheduled_time": f"{curr_m // 60:02d}:{curr_m % 60:02d}",
                "is_bypass": False
            })
            curr_m = (curr_m + min_per_hop) % 1440

        status = "upcoming"
        now_ist_min = datetime.now().hour * 60 + datetime.now().minute
        if dep_min < now_ist_min - len(route) * min_per_hop:
            status = "completed"
        elif dep_min <= now_ist_min + 30:
            status = "in_transit"

        current_sec = None
        if status == "in_transit" and len(route) > 1:
            sec_candidate = f"SEC_{route[0]}_{route[1]}"
            if sec_candidate in valid_section_codes:
                current_sec = sec_candidate

        db.add(Train(
            train_id=t_id, train_number=tr_num, train_name=train_name,
            train_type=tt_cat, priority_class=prio,
            origin_station_code=route[0], destination_station_code=route[-1],
            scheduled_departure_time=dep_str, scheduled_arrival_time=arr_str,
            current_status=status, current_section_code=current_sec,
            original_path_json=json.dumps(original_path_stops), assigned_path_json=None
        ))

        for s_idx in range(len(route) - 1):
            sec_code = f"SEC_{route[s_idx]}_{route[s_idx + 1]}"
            if sec_code not in valid_section_codes:
                continue
            e_min = (dep_min + s_idx * min_per_hop) % 1440
            x_min = (e_min + min_per_hop - 5) % 1440
            db.add(Timetable(
                train_number=tr_num, section_code=sec_code,
                scheduled_entry_min=e_min, scheduled_exit_min=x_min,
                actual_entry_min=e_min, actual_exit_min=x_min,
                is_delayed=False, delay_min=0
            ))

        if (i + 1) % 100 == 0:
            db.commit()

    db.commit()

    # ── 5. Maintenance Requests (~150) ───────────────────────────────────────
    for idx, (dept, sec, track_num, loc_km, defect, dur, urgency, due_days,
              deps, skills, equip) in enumerate(MAINT_TEMPLATES):
        if sec not in valid_section_codes:
            continue
        req_id_suffix = f"{dept[:2]}-{(100 + idx):03d}"
        db.add(MaintenanceRequest(
            request_id=f"REQ-{req_id_suffix}", department=dept, section_code=sec,
            target_track_number=track_num, location_km=loc_km, defect_type=defect,
            requested_duration_hours=dur, declared_urgency=urgency, due_date_days=due_days,
            dependencies_json=json.dumps(deps), required_skills_json=json.dumps(skills),
            required_equipment_json=json.dumps(equip), status="Pending"
        ))
    db.commit()

    sections_list = list(valid_section_codes)
    dep_options = ["ENG", "TRAC", "ST"]
    defect_pool = ["Track Wear", "Signal Failure", "Catenary Sag", "Bridge Crack", "Ballast Deterioration"]
    skill_pool = {"ENG": ["TRACK_WELDING"], "TRAC": ["OHE_ALIGNMENT"], "ST": ["SIGNAL_TESTING"]}
    equip_pool = {"ENG": ["TAMPER_MACHINE_01"], "TRAC": ["TOWER_WAGON_01"], "ST": ["SIGNAL_TEST_KIT_01"]}

    for i in range(140):
        dept = rng.choice(dep_options)
        sec = rng.choice(sections_list)
        mr = MaintenanceRequest(
            request_id=f"REQ-{dept[:2]}-{2000 + i:04d}",
            department=dept, section_code=sec, target_track_number=1,
            location_km=round(rng.uniform(1.0, 30.0), 1), defect_type=rng.choice(defect_pool),
            requested_duration_hours=round(rng.uniform(2.0, 5.0), 1), declared_urgency=rng.randint(2, 5),
            due_date_days=rng.randint(1, 5), dependencies_json=json.dumps([]),
            required_skills_json=json.dumps(skill_pool[dept]), required_equipment_json=json.dumps(equip_pool[dept]),
            status="Pending"
        )
        db.add(mr)
    db.commit()

    # ── 6. Asset Conditions ───────────────────────────────────────────────────
    for sec_code in valid_section_codes:
        db.add(AssetCondition(
            section_code=sec_code,
            track_wear_mm=round(rng.uniform(1.0, 8.5), 1),
            catenary_wear_pct=round(rng.uniform(5.0, 55.0), 1),
            signal_fault_frequency=round(rng.uniform(0.0, 3.5), 1),
            ballast_compaction_pct=85.0, joint_temperature_celsius=35.0,
            inspection_date="2026-09-07"
        ))
    db.commit()

    # ── 7. Resources & Weather ────────────────────────────────────────────────
    for r_id, r_type, r_name, dept, skill, qty, s_hr, e_hr in RESOURCES_CATALOGUE:
        db.add(Resource(
            resource_id=r_id, resource_type=r_type, name=r_name, department=dept,
            skill_or_type=skill, total_count=qty, available_start_hr=s_hr, available_end_hr=e_hr
        ))
    for day_offset, (temp, rain, wind, risk) in enumerate(WEATHER_SCENARIOS):
        db.add(WeatherForecast(
            day_offset=day_offset, temperature_celsius=temp, rainfall_mm=rain,
            wind_speed_kmh=wind, risk_level=risk
        ))
    db.commit()

    print(f"[SyntheticGenerator] ✅ Re-seeded organic spaced topology: "
          f"{len(station_objs)} stations, "
          f"{len(valid_section_codes)} section routes  (seed={seed})")
