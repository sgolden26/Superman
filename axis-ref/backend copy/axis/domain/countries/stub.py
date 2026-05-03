"""Hand-authored country dossiers.

Numbers and named officials reflect publicly reported open-source figures up to
early 2025. They are illustrative for an exercise scenario and not authoritative.
Once a live loader (Factbook/IISS/etc.) lands behind `CountryRepository`, this
stub stays as the offline-demo seed.
"""

from __future__ import annotations

from axis.domain.countries.repository import CountryRepository
from axis.domain.country import (
    BilateralRelation,
    Border,
    CabinetMember,
    Composition,
    Country,
    Demographics,
    Diplomacy,
    EnergyLogistics,
    Geography,
    Government,
    InventoryLine,
    InventoryStatus,
    KeyBase,
    Military,
    MilitaryPosture,
    NuclearPosture,
    NuclearStatus,
    PublicOpinion,
    RegimeType,
    RelationStatus,
    ServiceBranch,
    Treaty,
)


COUNTRY_ACTIONS_DEMOCRATIC = (
    "raise_alert_level",
    "mobilise_reserves",
    "invoke_article_5",
    "open_air_corridor",
    "request_emergency_session",
    "issue_public_statement",
    "expel_diplomats",
    "sever_diplomatic_ties",
    "impose_sanctions",
    "authorise_lethal_aid",
)

COUNTRY_ACTIONS_AUTHORITARIAN = (
    "raise_alert_level",
    "mobilise_reserves",
    "declare_martial_law",
    "close_borders",
    "issue_public_statement",
    "expel_diplomats",
    "sever_diplomatic_ties",
    "host_allied_forces",
    "authorise_strategic_strike",
    "censor_independent_media",
)

COUNTRY_ACTIONS_AT_WAR = (
    "raise_alert_level",
    "general_mobilisation",
    "request_lethal_aid",
    "declare_martial_law",
    "close_airspace",
    "issue_public_statement",
    "request_emergency_session",
    "authorise_strategic_strike",
    "expel_diplomats",
    "sever_diplomatic_ties",
)


def _russia() -> Country:
    return Country(
        id="ru",
        iso_a2="RU",
        iso_a3="RUS",
        name="Russia",
        official_name="Russian Federation",
        faction_id="ru",
        flag_emoji="\U0001F1F7\U0001F1FA",
        capital_city_id="city.moscow",
        government=Government(
            regime_type=RegimeType.AUTHORITARIAN,
            head_of_state="Vladimir Putin",
            head_of_government="Mikhail Mishustin",
            cabinet=(
                CabinetMember(title="Defence Minister", name="Andrei Belousov"),
                CabinetMember(title="Foreign Minister", name="Sergey Lavrov"),
                CabinetMember(title="Interior Minister", name="Vladimir Kolokoltsev"),
                CabinetMember(title="FSB Director", name="Alexander Bortnikov"),
                CabinetMember(title="Chief of General Staff", name="Valery Gerasimov"),
                CabinetMember(title="Security Council Secretary", name="Sergei Shoigu"),
            ),
            approval_rating=0.78,
            stability_index=0.62,
            last_election="2024-03-17",
            next_election="2030-03",
        ),
        military=Military(
            active_personnel=1_320_000,
            reserve_personnel=2_000_000,
            paramilitary=554_000,
            branches=(
                ServiceBranch(
                    name="Russian Ground Forces",
                    personnel=550_000,
                    inventory=(
                        InventoryLine("mbt", "T-72B3M / T-80BVM / T-90M", 2_800),
                        InventoryLine("mbt", "T-62 (recovered)", 800, InventoryStatus.LEGACY),
                        InventoryLine("ifv", "BMP-2 / BMP-3", 4_500),
                        InventoryLine("apc", "BTR-82A", 2_400),
                        InventoryLine("spg", "2S19 Msta-S / 2S35 Koalitsiya", 720),
                        InventoryLine("mlrs", "BM-21 / Tornado-S / TOS-1A", 920),
                        InventoryLine("ssm", "Iskander-M", 80),
                    ),
                ),
                ServiceBranch(
                    name="Russian Aerospace Forces (VKS)",
                    personnel=165_000,
                    inventory=(
                        InventoryLine("fighter", "Su-35S", 110),
                        InventoryLine("fighter", "Su-30SM/SM2", 130),
                        InventoryLine("multirole", "Su-34", 130),
                        InventoryLine("attack", "Su-25SM3", 190),
                        InventoryLine("interceptor", "MiG-31BM/K", 90),
                        InventoryLine("bomber_strategic", "Tu-95MS / Tu-160 / Tu-22M3", 130),
                        InventoryLine("helo_attack", "Ka-52 / Mi-28N / Mi-35M", 360),
                        InventoryLine("uav", "Orlan-10 / Lancet / Geran-2", 4_000),
                        InventoryLine("sam_long", "S-400 Triumf", 56),
                        InventoryLine("sam_strategic", "S-500 Prometey", 2, InventoryStatus.LIMITED),
                    ),
                ),
                ServiceBranch(
                    name="Russian Navy",
                    personnel=150_000,
                    inventory=(
                        InventoryLine("ssbn", "Project 667BDRM / 955 Borei", 11),
                        InventoryLine("ssn", "Project 949A / 885M Yasen-M", 17),
                        InventoryLine("ssk", "Kilo / Improved Kilo", 22),
                        InventoryLine("cruiser", "Project 1144 / 1164", 4),
                        InventoryLine("destroyer", "Project 956 / 1155", 12),
                        InventoryLine("frigate", "Admiral Gorshkov / Grigorovich", 9),
                        InventoryLine("corvette", "Steregushchiy / Karakurt / Buyan-M", 38),
                    ),
                ),
                ServiceBranch(
                    name="Strategic Rocket Forces",
                    personnel=50_000,
                    inventory=(
                        InventoryLine("icbm", "RS-24 Yars (mobile/silo)", 180),
                        InventoryLine("icbm", "RS-28 Sarmat", 4, InventoryStatus.LIMITED),
                        InventoryLine("icbm", "UR-100N / R-36M (legacy)", 60, InventoryStatus.LEGACY),
                    ),
                ),
                ServiceBranch(
                    name="Airborne Forces (VDV)",
                    personnel=45_000,
                    inventory=(
                        InventoryLine("ifv_airborne", "BMD-4M", 380),
                        InventoryLine("apc_airborne", "BTR-MD Rakushka", 220),
                    ),
                ),
                ServiceBranch(
                    name="Rosgvardiya (National Guard)",
                    personnel=340_000,
                    inventory=(),
                ),
            ),
            doctrine=(
                "Strategic deterrence; escalate-to-de-escalate; combined-arms attrition; "
                "non-contact precision strike; nuclear umbrella for sub-conventional revisionism."
            ),
            posture=MilitaryPosture.OFFENSIVE,
            alert_level=4,
            c2_nodes=(
                "National Defence Management Centre (Moscow)",
                "Western MD HQ (St. Petersburg)",
                "Southern MD HQ (Rostov-on-Don)",
                "Joint Group of Forces HQ (Rostov)",
            ),
        ),
        nuclear=NuclearPosture(
            status=NuclearStatus.NWS,
            warheads=4_380,
            delivery_systems=(
                "RS-24 Yars",
                "RS-28 Sarmat",
                "Bulava (Borei SSBN)",
                "Iskander-M / Kinzhal",
                "Tu-160 / Tu-95MS (Kh-101/102)",
            ),
            declared_posture=(
                "Reserves the right to use nuclear weapons in response to nuclear or "
                "conventional attack threatening the existence of the state."
            ),
            nfu=False,
        ),
        demographics=Demographics(
            population=143_400_000,
            median_age=40.3,
            urbanisation=0.75,
            ethnic_groups=(
                Composition("Russian", 0.80),
                Composition("Tatar", 0.04),
                Composition("Ukrainian", 0.01),
                Composition("Bashkir", 0.01),
                Composition("Chuvash", 0.01),
                Composition("Other", 0.13),
            ),
            languages=(
                Composition("Russian", 0.85),
                Composition("Tatar", 0.03),
                Composition("Other", 0.12),
            ),
            religions=(
                Composition("Orthodox", 0.63),
                Composition("Muslim", 0.07),
                Composition("None / unspecified", 0.27),
                Composition("Other", 0.03),
            ),
        ),
        diplomacy=Diplomacy(
            alliance_memberships=("CSTO", "CIS", "EAEU", "BRICS", "SCO", "UNSC P5"),
            treaties=(
                Treaty("CSTO Charter", "collective_defence", ("CSTO members",), True),
                Treaty("New START", "arms_control", ("ru", "us"), False),
                Treaty("INF", "arms_control", ("ru", "us"), False),
                Treaty("Union State Treaty", "political_military", ("ru", "by"), True),
            ),
            relations=(
                BilateralRelation("ua", RelationStatus.AT_WAR, -1.0),
                BilateralRelation("by", RelationStatus.ALLIED, 0.95),
                BilateralRelation("us", RelationStatus.HOSTILE, -0.9),
                BilateralRelation("pl", RelationStatus.HOSTILE, -0.85),
                BilateralRelation("ge", RelationStatus.STRAINED, -0.6),
                BilateralRelation("md", RelationStatus.STRAINED, -0.55),
                BilateralRelation("ro", RelationStatus.HOSTILE, -0.8),
                BilateralRelation("de", RelationStatus.STRAINED, -0.7),
                BilateralRelation("cn", RelationStatus.FRIENDLY, 0.75),
                BilateralRelation("ir", RelationStatus.FRIENDLY, 0.7),
                BilateralRelation("kp", RelationStatus.FRIENDLY, 0.75),
            ),
        ),
        energy=EnergyLogistics(
            oil_dependence=0.0,  # net exporter
            gas_dependence=0.0,
            top_gas_supplier="domestic (Gazprom)",
            pipelines=(
                "Druzhba (oil)",
                "ESPO (oil, Pacific)",
                "Power of Siberia (gas, China)",
                "TurkStream (gas)",
                "Yamal-Europe (gas, suspended)",
            ),
            key_ports=(
                "Novorossiysk",
                "St. Petersburg / Ust-Luga",
                "Murmansk",
                "Vladivostok",
                "Sevastopol (occupied)",
            ),
            rail_gauge_mm=1520,
            strategic_reserves_days=180,
        ),
        public_opinion=PublicOpinion(
            war_support=0.55,
            institutional_trust=0.40,
            censorship_index=0.92,
            protest_intensity=0.10,
            top_outlets=(
                "Channel One (state)",
                "Rossiya 1 (state)",
                "RIA Novosti (state)",
                "TASS (state)",
                "Meduza (exile)",
            ),
        ),
        geography=Geography(
            area_km2=17_098_000,
            land_borders=(
                Border("ua", 1_944),
                Border("by", 1_312),
                Border("kz", 7_644),
                Border("ge", 894),
                Border("fi", 1_309),
                Border("ee", 324),
                Border("lv", 332),
                Border("lt", 273),
                Border("pl", 210),
                Border("no", 196),
                Border("cn", 4_209),
                Border("mn", 3_485),
                Border("kp", 18),
                Border("az", 338),
            ),
            key_bases=(
                KeyBase("Khmeimim Air Base (Syria)", "air_base", 35.9486, 35.4108, "ru"),
                KeyBase("Severomorsk (Northern Fleet)", "naval_base", 33.4170, 69.0700, "ru"),
                KeyBase("Sevastopol (Black Sea Fleet)", "naval_base", 33.5283, 44.6166, "ru"),
                KeyBase("Vladivostok (Pacific Fleet)", "naval_base", 131.8869, 43.1155, "ru"),
                KeyBase("Engels-2 Strategic Air Base", "air_base", 46.2106, 51.4783, "ru"),
                KeyBase("Plesetsk Cosmodrome", "command_node", 40.5772, 62.9272, "ru"),
                KeyBase("Yelnya Garrison (1st Tank Army)", "training_ground", 33.1750, 54.5783, "ru"),
                KeyBase("Voronezh Garrison (20th CAA)", "training_ground", 39.2003, 51.6720, "ru"),
                KeyBase("Belgorod Air Base", "air_base", 36.5900, 50.6442, "ru"),
                KeyBase("Rostov-on-Don JFC HQ", "command_node", 39.7233, 47.2357, "ru"),
            ),
        ),
        available_actions=COUNTRY_ACTIONS_AUTHORITARIAN,
    )


def _ukraine() -> Country:
    return Country(
        id="ua",
        iso_a2="UA",
        iso_a3="UKR",
        name="Ukraine",
        official_name="Ukraine",
        faction_id="ua",
        flag_emoji="\U0001F1FA\U0001F1E6",
        capital_city_id="city.kyiv",
        government=Government(
            regime_type=RegimeType.LIBERAL_DEMOCRACY,
            head_of_state="Volodymyr Zelenskyy",
            head_of_government="Denys Shmyhal",
            cabinet=(
                CabinetMember(title="Defence Minister", name="Rustem Umerov"),
                CabinetMember(title="Foreign Minister", name="Andrii Sybiha"),
                CabinetMember(title="Interior Minister", name="Ihor Klymenko"),
                CabinetMember(title="Commander-in-Chief", name="Oleksandr Syrskyi"),
                CabinetMember(title="SBU Head", name="Vasyl Maliuk"),
                CabinetMember(title="GUR (Military Intelligence)", name="Kyrylo Budanov"),
            ),
            approval_rating=0.62,
            stability_index=0.55,
            last_election="2019-04-21",  # martial law suspends elections
            next_election="postponed (martial law)",
        ),
        military=Military(
            active_personnel=900_000,
            reserve_personnel=1_200_000,
            paramilitary=120_000,
            branches=(
                ServiceBranch(
                    name="Ground Forces (ZSU)",
                    personnel=350_000,
                    inventory=(
                        InventoryLine("mbt", "T-64BV / T-72 family", 1_300),
                        InventoryLine("mbt", "Leopard 2A4/2A6 (DE/PL/CA)", 90),
                        InventoryLine("mbt", "Challenger 2 (UK)", 14, InventoryStatus.LIMITED),
                        InventoryLine("mbt", "M1A1 Abrams (US)", 31, InventoryStatus.LIMITED),
                        InventoryLine("ifv", "BMP-1/BMP-2 (legacy + captured)", 1_400),
                        InventoryLine("ifv", "Bradley (US)", 200),
                        InventoryLine("ifv", "Marder 1A3 (DE)", 80),
                        InventoryLine("ifv", "CV90 (SE)", 50),
                        InventoryLine("apc", "Stryker / M113 / YPR-765", 1_100),
                        InventoryLine("spg", "M109A6 Paladin", 100),
                        InventoryLine("spg", "Caesar / AHS Krab / Archer / PzH 2000", 200),
                        InventoryLine("mlrs", "HIMARS M142", 39),
                        InventoryLine("mlrs", "BM-27 / BM-30 Smerch", 90),
                        InventoryLine("atgm", "Javelin / NLAW / Stugna-P", 25_000),
                    ),
                ),
                ServiceBranch(
                    name="Air Force (PSU)",
                    personnel=45_000,
                    inventory=(
                        InventoryLine("fighter", "MiG-29", 35, InventoryStatus.LIMITED),
                        InventoryLine("fighter", "Su-27", 18, InventoryStatus.LIMITED),
                        InventoryLine("fighter", "F-16AM/BM (NL/DK/NO/BE)", 20),
                        InventoryLine("attack", "Su-25", 24, InventoryStatus.LIMITED),
                        InventoryLine("strike", "Su-24M", 12, InventoryStatus.LIMITED),
                        InventoryLine("sam_long", "Patriot PAC-3 (US/DE/NL)", 5),
                        InventoryLine("sam_med", "IRIS-T SLM (DE)", 8),
                        InventoryLine("sam_med", "NASAMS", 6),
                        InventoryLine("sam_med", "S-300P (legacy)", 30, InventoryStatus.LIMITED),
                    ),
                ),
                ServiceBranch(
                    name="Navy",
                    personnel=11_000,
                    inventory=(
                        InventoryLine("opv", "Island-class (US transfer)", 5),
                        InventoryLine("usv", "Magura V5 / Sea Baby", 60),
                        InventoryLine("missile", "Neptune RBS-15 (anti-ship)", 12),
                    ),
                ),
                ServiceBranch(
                    name="Air Assault Forces (DShV)",
                    personnel=25_000,
                    inventory=(
                        InventoryLine("ifv_airborne", "BMD-1/2 (legacy)", 80, InventoryStatus.LEGACY),
                    ),
                ),
                ServiceBranch(
                    name="Special Operations Forces (SSO)",
                    personnel=4_000,
                    inventory=(),
                ),
                ServiceBranch(
                    name="Territorial Defence Forces (TrO)",
                    personnel=120_000,
                    inventory=(),
                ),
                ServiceBranch(
                    name="National Guard / Border Guard",
                    personnel=80_000,
                    inventory=(),
                ),
            ),
            doctrine=(
                "Active defence-in-depth; deep precision strike; ISR-LRT kill chains; "
                "drone-saturated tactical level; partner-equipped manoeuvre brigades."
            ),
            posture=MilitaryPosture.DEFENSIVE,
            alert_level=5,
            c2_nodes=(
                "General Staff (Kyiv)",
                "OK 'Pivnich' (North)",
                "OK 'Skhid' (East)",
                "OK 'Pivden' (South)",
                "OK 'Zakhid' (West)",
            ),
        ),
        nuclear=NuclearPosture(
            status=NuclearStatus.NONE,
            warheads=0,
            delivery_systems=(),
            declared_posture=(
                "Non-nuclear under the 1994 Budapest Memorandum; relies on Western "
                "deterrence and conventional precision strike."
            ),
            nfu=None,
        ),
        demographics=Demographics(
            population=33_200_000,  # post-2022 displaced/lost-territory adjusted
            median_age=42.3,
            urbanisation=0.70,
            ethnic_groups=(
                Composition("Ukrainian", 0.78),
                Composition("Russian", 0.17),
                Composition("Belarusian", 0.01),
                Composition("Crimean Tatar", 0.01),
                Composition("Other", 0.03),
            ),
            languages=(
                Composition("Ukrainian", 0.72),
                Composition("Russian", 0.25),
                Composition("Other", 0.03),
            ),
            religions=(
                Composition("Orthodox (OCU/UOC)", 0.65),
                Composition("Greek Catholic", 0.10),
                Composition("Roman Catholic", 0.02),
                Composition("None / unspecified", 0.20),
                Composition("Other", 0.03),
            ),
        ),
        diplomacy=Diplomacy(
            alliance_memberships=("UN", "EU candidate", "OSCE", "Council of Europe"),
            treaties=(
                Treaty("Budapest Memorandum", "security_assurance", ("us", "uk", "ru", "ua"), False),
                Treaty("EU Association Agreement", "political_economic", ("eu", "ua"), True),
                Treaty("UK-Ukraine 100-Year Partnership", "bilateral", ("uk", "ua"), True),
                Treaty("US-Ukraine Bilateral Security Agreement", "bilateral", ("us", "ua"), True),
            ),
            relations=(
                BilateralRelation("ru", RelationStatus.AT_WAR, -1.0),
                BilateralRelation("by", RelationStatus.HOSTILE, -0.9),
                BilateralRelation("pl", RelationStatus.ALLIED, 0.85),
                BilateralRelation("md", RelationStatus.ALLIED, 0.75),
                BilateralRelation("ro", RelationStatus.ALLIED, 0.8),
                BilateralRelation("us", RelationStatus.ALLIED, 0.85),
                BilateralRelation("uk", RelationStatus.ALLIED, 0.9),
                BilateralRelation("de", RelationStatus.ALLIED, 0.8),
                BilateralRelation("ge", RelationStatus.FRIENDLY, 0.7),
                BilateralRelation("tr", RelationStatus.FRIENDLY, 0.55),
            ),
        ),
        energy=EnergyLogistics(
            oil_dependence=0.6,
            gas_dependence=0.3,
            top_gas_supplier="EU reverse-flow (SK, HU, PL)",
            pipelines=(
                "Druzhba (oil, partial)",
                "Trans-Balkan (gas, reverse)",
                "Brotherhood (transit, halted Jan 2025)",
            ),
            key_ports=("Odesa", "Pivdennyi", "Chornomorsk", "Reni", "Izmail"),
            rail_gauge_mm=1520,
            strategic_reserves_days=45,
        ),
        public_opinion=PublicOpinion(
            war_support=0.85,
            institutional_trust=0.65,
            censorship_index=0.32,  # martial-law media regime
            protest_intensity=0.12,
            top_outlets=(
                "Suspilne (public)",
                "Ukrainska Pravda",
                "Kyiv Independent",
                "Hromadske",
                "ICTV",
            ),
        ),
        geography=Geography(
            area_km2=603_500,
            land_borders=(
                Border("ru", 1_944),
                Border("by", 1_111),
                Border("pl", 535),
                Border("sk", 90),
                Border("hu", 103),
                Border("ro", 601),
                Border("md", 1_202),
            ),
            key_bases=(
                KeyBase("Bankova / OP HQ (Kyiv)", "command_node", 30.5234, 50.4501, "ua"),
                KeyBase("General Staff (Kyiv)", "command_node", 30.4900, 50.4490, "ua"),
                KeyBase("Vasylkiv Air Base", "air_base", 30.3155, 50.2350, "ua"),
                KeyBase("Starokostiantyniv Air Base", "air_base", 27.2433, 49.7600, "ua"),
                KeyBase("Mykolaiv Naval HQ", "naval_base", 31.9946, 46.9750, "ua"),
                KeyBase("Yavoriv Combined Arms Centre", "training_ground", 23.4000, 49.9333, "ua"),
                KeyBase("Desna Training Centre", "training_ground", 31.2667, 51.0167, "ua"),
                KeyBase("Kharkiv OK 'Skhid' HQ", "command_node", 36.2304, 49.9935, "ua"),
                KeyBase("Dnipro Logistics Hub", "command_node", 35.0000, 48.4500, "ua"),
            ),
        ),
        available_actions=COUNTRY_ACTIONS_AT_WAR,
    )


def _belarus() -> Country:
    return Country(
        id="by",
        iso_a2="BY",
        iso_a3="BLR",
        name="Belarus",
        official_name="Republic of Belarus",
        faction_id="ru",
        flag_emoji="\U0001F1E7\U0001F1FE",
        capital_city_id="city.minsk",
        government=Government(
            regime_type=RegimeType.AUTHORITARIAN,
            head_of_state="Alexander Lukashenko",
            head_of_government="Roman Golovchenko",
            cabinet=(
                CabinetMember(title="Defence Minister", name="Viktor Khrenin"),
                CabinetMember(title="Foreign Minister", name="Maxim Ryzhenkov"),
                CabinetMember(title="Interior Minister", name="Ivan Kubrakov"),
                CabinetMember(title="KGB Chairman", name="Ivan Tertel"),
            ),
            approval_rating=0.32,
            stability_index=0.45,
            last_election="2025-01-26",
            next_election="2030-01",
        ),
        military=Military(
            active_personnel=48_000,
            reserve_personnel=290_000,
            paramilitary=110_000,
            branches=(
                ServiceBranch(
                    name="Belarusian Ground Forces",
                    personnel=29_000,
                    inventory=(
                        InventoryLine("mbt", "T-72B / T-72B3 (RU-supplied)", 580),
                        InventoryLine("ifv", "BMP-2", 1_165, InventoryStatus.LIMITED),
                        InventoryLine("apc", "BTR-80 / BTR-82A", 188),
                        InventoryLine("spg", "2S19 Msta-S", 130),
                        InventoryLine("mlrs", "BM-21 / Polonez", 192),
                        InventoryLine("ssm", "Iskander-M (RU-host)", 12),
                    ),
                ),
                ServiceBranch(
                    name="Air Force & Air Defence",
                    personnel=11_500,
                    inventory=(
                        InventoryLine("fighter", "Su-30SM (RU)", 12),
                        InventoryLine("fighter", "MiG-29", 32, InventoryStatus.LIMITED),
                        InventoryLine("attack", "Su-25", 56, InventoryStatus.LEGACY),
                        InventoryLine("helo_attack", "Mi-24", 12, InventoryStatus.LEGACY),
                        InventoryLine("sam_long", "S-400 (RU-detached)", 4),
                        InventoryLine("sam_med", "S-300PS", 16, InventoryStatus.LIMITED),
                    ),
                ),
                ServiceBranch(
                    name="Special Operations Forces",
                    personnel=6_000,
                    inventory=(InventoryLine("sf_brigade", "Brigades", 4),),
                ),
                ServiceBranch(name="Internal Troops (MVD)", personnel=11_000, inventory=()),
            ),
            doctrine="Union State integration; forward host for Russian strategic assets.",
            posture=MilitaryPosture.DETERRENT,
            alert_level=3,
            c2_nodes=("Minsk MOD", "Asipovichy Storage Site", "Baranavichy Air Base C2"),
        ),
        nuclear=NuclearPosture(
            status=NuclearStatus.UMBRELLA_HOST,
            warheads=0,
            delivery_systems=("Iskander-M (RU)", "Su-25 nuclear-capable retrofit"),
            declared_posture=(
                "Hosts Russian non-strategic nuclear weapons under Union State arrangements."
            ),
            nfu=None,
        ),
        demographics=Demographics(
            population=9_150_000,
            median_age=41.5,
            urbanisation=0.80,
            ethnic_groups=(
                Composition("Belarusian", 0.84),
                Composition("Russian", 0.08),
                Composition("Polish", 0.03),
                Composition("Ukrainian", 0.02),
                Composition("Other", 0.03),
            ),
            languages=(
                Composition("Russian", 0.71),
                Composition("Belarusian", 0.26),
                Composition("Other", 0.03),
            ),
            religions=(
                Composition("Orthodox", 0.48),
                Composition("Roman Catholic", 0.07),
                Composition("None / unspecified", 0.41),
                Composition("Other", 0.04),
            ),
        ),
        diplomacy=Diplomacy(
            alliance_memberships=("CSTO", "Union State", "CIS", "EAEU", "SCO observer"),
            treaties=(
                Treaty("Union State Treaty", "political_military", ("ru", "by"), True),
                Treaty("CSTO Charter", "collective_defence", ("CSTO members",), True),
                Treaty("EU Sanctions Regime", "sanctions_target", ("EU",), True),
            ),
            relations=(
                BilateralRelation("ru", RelationStatus.ALLIED, 0.95),
                BilateralRelation("ua", RelationStatus.HOSTILE, -0.9),
                BilateralRelation("pl", RelationStatus.HOSTILE, -0.8),
                BilateralRelation("lt", RelationStatus.HOSTILE, -0.75),
                BilateralRelation("lv", RelationStatus.HOSTILE, -0.65),
                BilateralRelation("us", RelationStatus.HOSTILE, -0.85),
                BilateralRelation("de", RelationStatus.STRAINED, -0.55),
            ),
        ),
        energy=EnergyLogistics(
            oil_dependence=0.85,
            gas_dependence=1.0,
            top_gas_supplier="Russia (Gazprom)",
            pipelines=("Druzhba (oil)", "Yamal-Europe (gas)", "Northern Lights (gas)"),
            key_ports=(),
            rail_gauge_mm=1520,
            strategic_reserves_days=60,
        ),
        public_opinion=PublicOpinion(
            war_support=0.28,
            institutional_trust=0.30,
            censorship_index=0.85,
            protest_intensity=0.18,
            top_outlets=("Belta (state)", "ONT (state)", "Nasha Niva (exile)", "Zerkalo (exile)"),
        ),
        geography=Geography(
            area_km2=207_600,
            land_borders=(
                Border("ru", 1_312),
                Border("ua", 1_111),
                Border("pl", 418),
                Border("lt", 678),
                Border("lv", 173),
            ),
            key_bases=(
                KeyBase("Baranavichy Air Base", "air_base", 26.0500, 53.1000, "by"),
                KeyBase("Lida Air Base", "air_base", 25.3733, 53.8867, "by"),
                KeyBase("Asipovichy 1405 Storage", "command_node", 28.6400, 53.3000, "by"),
                KeyBase("Brest Garrison", "training_ground", 23.7000, 52.0833, "by"),
                KeyBase("Hantsavichy EW Radar (RU)", "command_node", 26.5333, 52.8500, "by"),
            ),
        ),
        available_actions=COUNTRY_ACTIONS_AUTHORITARIAN,
    )


def _lithuania() -> Country:
    """Kept for back-compat; Lithuania is no longer the headline scenario."""
    return Country(
        id="lt",
        iso_a2="LT",
        iso_a3="LTU",
        name="Lithuania",
        official_name="Republic of Lithuania",
        faction_id="nato",
        flag_emoji="\U0001F1F1\U0001F1F9",
        capital_city_id="city.vilnius",
        government=Government(
            regime_type=RegimeType.LIBERAL_DEMOCRACY,
            head_of_state="Gitanas Nauseda",
            head_of_government="Gintautas Paluckas",
            cabinet=(
                CabinetMember(title="Defence Minister", name="Dovile Sakaliene"),
                CabinetMember(title="Foreign Minister", name="Kestutis Budrys"),
                CabinetMember(title="Interior Minister", name="Vladislav Kondratovic"),
            ),
            approval_rating=0.46,
            stability_index=0.78,
            last_election="2024-10-13",
            next_election="2028-10",
        ),
        military=Military(
            active_personnel=23_000,
            reserve_personnel=104_000,
            paramilitary=14_500,
            branches=(),
            doctrine="Total defence; integrate with NATO eFP.",
            posture=MilitaryPosture.DEFENSIVE,
            alert_level=4,
            c2_nodes=("Vilnius MOD",),
        ),
        nuclear=NuclearPosture(
            status=NuclearStatus.UMBRELLA_HOST,
            warheads=0,
            delivery_systems=(),
            declared_posture="Non-nuclear under NATO extended deterrence.",
            nfu=None,
        ),
        demographics=Demographics(
            population=2_790_000,
            median_age=44.8,
            urbanisation=0.68,
            ethnic_groups=(
                Composition("Lithuanian", 0.84),
                Composition("Polish", 0.06),
                Composition("Russian", 0.05),
                Composition("Other", 0.05),
            ),
            languages=(
                Composition("Lithuanian", 0.85),
                Composition("Russian", 0.08),
                Composition("Polish", 0.06),
                Composition("Other", 0.01),
            ),
            religions=(
                Composition("Roman Catholic", 0.74),
                Composition("Orthodox", 0.04),
                Composition("None / unspecified", 0.20),
                Composition("Other", 0.02),
            ),
        ),
        diplomacy=Diplomacy(
            alliance_memberships=("NATO", "EU", "UN"),
            treaties=(
                Treaty("North Atlantic Treaty", "collective_defence", ("NATO members",), True),
            ),
            relations=(
                BilateralRelation("ru", RelationStatus.HOSTILE, -0.85),
                BilateralRelation("by", RelationStatus.HOSTILE, -0.7),
                BilateralRelation("pl", RelationStatus.ALLIED, 0.85),
            ),
        ),
        energy=EnergyLogistics(
            oil_dependence=0.95,
            gas_dependence=1.0,
            top_gas_supplier="USA / Norway (LNG)",
            pipelines=("Klaipeda LNG", "GIPL"),
            key_ports=("Klaipeda",),
            rail_gauge_mm=1520,
            strategic_reserves_days=90,
        ),
        public_opinion=PublicOpinion(
            war_support=0.62,
            institutional_trust=0.55,
            censorship_index=0.10,
            protest_intensity=0.18,
            top_outlets=("LRT", "Delfi", "15min", "BNS"),
        ),
        geography=Geography(
            area_km2=65_300,
            land_borders=(
                Border("lv", 588),
                Border("by", 678),
                Border("pl", 104),
                Border("ru", 273),
            ),
            key_bases=(
                KeyBase("Siauliai Air Base (NATO BAP)", "air_base", 23.3950, 55.8945, "lt"),
            ),
        ),
        available_actions=COUNTRY_ACTIONS_DEMOCRATIC,
    )


class StubCountryRepository(CountryRepository):
    """Hand-authored country dossiers."""

    def __init__(self) -> None:
        self._countries: dict[str, Country] = {
            "ru": _russia(),
            "ua": _ukraine(),
            "by": _belarus(),
            "lt": _lithuania(),
        }

    def get(self, country_id: str) -> Country:
        try:
            return self._countries[country_id]
        except KeyError as exc:
            raise KeyError(f"StubCountryRepository: unknown country {country_id!r}") from exc

    def list_ids(self) -> tuple[str, ...]:
        return tuple(self._countries.keys())
