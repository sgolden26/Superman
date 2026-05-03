"""Eastern Europe scenario: Russia-Ukraine theatre.

The scenario id stays `eastern_europe` for back-compat with intel/decision
packages. Content has been re-pointed to the Russia-Ukraine theatre with a
~150-unit OOB, depots/airfields/naval bases, ISR coverage, missile arcs, AORs,
supply lines, the line of contact and 27 Ukrainian admin-1 oblasts.

Coordinates are open-source approximate. Polygons for countries and oblasts
are loaded by the frontend from `frontend/public/borders/` and merged by
ISO code, so this seed only carries metadata for those entities.
"""

from __future__ import annotations

from datetime import datetime, timezone

from axis.domain.coordinates import Coordinate
from axis.domain.countries import StubCountryRepository
from axis.domain.faction import Allegiance
from axis.domain.oblast import Oblast
from axis.domain.political import LeaderSignalType
from axis.domain.theater import Theater
from axis.factories.scenario_builder import ScenarioBuilder
from axis.units.domain import UnitKind


# ---------------------------------------------------------------------------
# Top-level entry
# ---------------------------------------------------------------------------


def build() -> Theater:
    builder = (
        ScenarioBuilder("eastern_europe", "Russia-Ukraine Theatre")
        .with_classification("UNCLASSIFIED // EXERCISE")
        .with_clock(datetime(2026, 4, 25, 11, 0, tzinfo=timezone.utc))
        .with_bbox(20.0, 43.5, 50.0, 56.5)
        .add_faction("ua", "Armed Forces of Ukraine", Allegiance.BLUE, "#5aa9ff")
        .add_faction("ru", "Russian Federation", Allegiance.RED, "#ff5a5a")
        .add_faction("nato", "NATO", Allegiance.BLUE, "#7cc4ff")
        .add_faction("neutral", "Neutral", Allegiance.NEUTRAL, "#d6a45a")
    )

    _add_countries(builder)
    _add_cities(builder)
    _add_oblasts(builder)
    _add_territories(builder)
    _add_units(builder)
    _add_depots(builder)
    _add_airfields(builder)
    _add_naval_bases(builder)
    _add_border_crossings(builder)
    _add_supply_lines(builder)
    _add_isr(builder)
    _add_missile_ranges(builder)
    _add_aors(builder)
    _add_frontline(builder)
    _add_political(builder)
    return builder.build()


# ---------------------------------------------------------------------------
# Countries
# ---------------------------------------------------------------------------


def _add_countries(b: ScenarioBuilder) -> None:
    repo = StubCountryRepository()
    for country_id in ("ru", "ua", "by"):
        b.add_country(repo.get(country_id))


# ---------------------------------------------------------------------------
# Cities (oblast capitals plus key military hubs)
# ---------------------------------------------------------------------------


_CITIES: tuple[tuple[str, str, str, float, float, int, str, tuple[str, ...], str | None], ...] = (
    # (id, name, faction, lon, lat, pop, importance, infra, country)
    # Ukraine - capital + oblast capitals
    ("city.kyiv", "Kyiv", "ua", 30.5234, 50.4501, 2_950_000, "capital",
        ("rail_hub", "air_base", "command_node"), "ua"),
    ("city.kharkiv", "Kharkiv", "ua", 36.2304, 49.9935, 1_430_000, "major",
        ("rail_hub", "command_node"), "ua"),
    ("city.dnipro", "Dnipro", "ua", 35.0462, 48.4647, 980_000, "major",
        ("rail_hub", "air_base", "command_node"), "ua"),
    ("city.odesa", "Odesa", "ua", 30.7233, 46.4825, 1_010_000, "major",
        ("naval_base", "rail_hub"), "ua"),
    ("city.lviv", "Lviv", "ua", 24.0297, 49.8397, 720_000, "major",
        ("rail_hub", "command_node"), "ua"),
    ("city.zaporizhzhia", "Zaporizhzhia", "ua", 35.1396, 47.8388, 720_000, "major",
        ("rail_hub", "command_node"), "ua"),
    ("city.kryvyi-rih", "Kryvyi Rih", "ua", 33.3920, 47.9105, 600_000, "major",
        ("rail_hub",), "ua"),
    ("city.mykolaiv", "Mykolaiv", "ua", 31.9946, 46.9750, 470_000, "major",
        ("naval_base", "rail_hub"), "ua"),
    ("city.vinnytsia", "Vinnytsia", "ua", 28.4682, 49.2331, 370_000, "minor",
        ("air_base", "command_node"), "ua"),
    ("city.poltava", "Poltava", "ua", 34.5514, 49.5883, 280_000, "minor",
        ("rail_hub",), "ua"),
    ("city.cherkasy", "Cherkasy", "ua", 32.0621, 49.4444, 270_000, "minor", (), "ua"),
    ("city.chernihiv", "Chernihiv", "ua", 31.2893, 51.4982, 280_000, "minor",
        ("rail_hub",), "ua"),
    ("city.sumy", "Sumy", "ua", 34.7981, 50.9077, 260_000, "minor", (), "ua"),
    ("city.zhytomyr", "Zhytomyr", "ua", 28.6587, 50.2547, 260_000, "minor",
        ("air_base",), "ua"),
    ("city.rivne", "Rivne", "ua", 26.2516, 50.6199, 246_000, "minor", (), "ua"),
    ("city.lutsk", "Lutsk", "ua", 25.3424, 50.7472, 213_000, "minor", (), "ua"),
    ("city.ternopil", "Ternopil", "ua", 25.5947, 49.5535, 220_000, "minor", (), "ua"),
    ("city.ivano-frankivsk", "Ivano-Frankivsk", "ua", 24.7111, 48.9226, 230_000, "minor", (), "ua"),
    ("city.uzhhorod", "Uzhhorod", "ua", 22.2879, 48.6208, 115_000, "minor", (), "ua"),
    ("city.chernivtsi", "Chernivtsi", "ua", 25.9404, 48.2916, 264_000, "minor", (), "ua"),
    ("city.khmelnytskyi", "Khmelnytskyi", "ua", 26.9871, 49.4229, 274_000, "minor", (), "ua"),
    ("city.kropyvnytskyi", "Kropyvnytskyi", "ua", 32.2597, 48.5079, 222_000, "minor", (), "ua"),
    ("city.kherson", "Kherson", "ua", 32.6178, 46.6354, 290_000, "minor",
        ("rail_hub",), "ua"),
    # Donetsk/Luhansk oblast capitals (de-facto contested; UA-claimed)
    ("city.donetsk", "Donetsk", "ru", 37.8028, 48.0159, 905_000, "major",
        ("rail_hub", "command_node"), "ua"),
    ("city.luhansk", "Luhansk", "ru", 39.3078, 48.5740, 410_000, "minor",
        ("rail_hub",), "ua"),
    ("city.simferopol", "Simferopol", "ru", 34.0931, 44.9520, 340_000, "minor",
        ("air_base",), "ua"),
    ("city.sevastopol", "Sevastopol", "ru", 33.5283, 44.6166, 510_000, "major",
        ("naval_base", "command_node"), "ua"),
    ("city.mariupol", "Mariupol", "ru", 37.5414, 47.0954, 425_000, "minor",
        ("naval_base", "rail_hub"), "ua"),
    # Russia
    ("city.moscow", "Moscow", "ru", 37.6173, 55.7558, 12_700_000, "capital",
        ("rail_hub", "air_base", "command_node"), "ru"),
    ("city.belgorod", "Belgorod", "ru", 36.5853, 50.5957, 391_000, "minor",
        ("rail_hub", "air_base"), "ru"),
    ("city.kursk", "Kursk", "ru", 36.1873, 51.7373, 440_000, "minor",
        ("rail_hub", "air_base"), "ru"),
    ("city.voronezh", "Voronezh", "ru", 39.2003, 51.6720, 1_050_000, "major",
        ("rail_hub", "air_base", "command_node"), "ru"),
    ("city.bryansk", "Bryansk", "ru", 34.3653, 53.2521, 405_000, "minor",
        ("rail_hub",), "ru"),
    ("city.rostov-on-don", "Rostov-on-Don", "ru", 39.7233, 47.2357, 1_140_000, "major",
        ("rail_hub", "command_node"), "ru"),
    ("city.krasnodar", "Krasnodar", "ru", 38.9760, 45.0355, 970_000, "minor",
        ("rail_hub", "air_base"), "ru"),
    ("city.smolensk", "Smolensk", "ru", 32.0411, 54.7826, 320_000, "minor",
        ("rail_hub",), "ru"),
    ("city.taganrog", "Taganrog", "ru", 38.9163, 47.2362, 245_000, "minor", (), "ru"),
    # Belarus
    ("city.minsk", "Minsk", "ru", 27.5615, 53.9045, 2_010_000, "capital",
        ("rail_hub", "air_base", "command_node"), "by"),
    ("city.gomel", "Gomel", "ru", 30.9754, 52.4242, 510_000, "minor",
        ("rail_hub",), "by"),
    ("city.brest", "Brest", "ru", 23.7340, 52.0976, 339_000, "minor",
        ("rail_hub",), "by"),
)


def _add_cities(b: ScenarioBuilder) -> None:
    for cid, name, fac, lon, lat, pop, imp, infra, country in _CITIES:
        b.add_city(cid, name, fac, lon, lat, pop, imp, infrastructure=infra, country_id=country)


# ---------------------------------------------------------------------------
# Oblasts (Ukrainian admin-1; polygons live in /borders/admin1_ua.geojson)
# ---------------------------------------------------------------------------


# (iso-3166-2, name, capital_city_id, faction-de-facto, control, contested,
#  population, area_km2, morale, civil_unrest, refugees_outflow)
_UA_OBLASTS: tuple[tuple[str, str, str | None, str, float, bool, int, float, float, float, int], ...] = (
    ("UA-30", "Kyiv City", "city.kyiv", "ua", 1.0, False, 2_950_000, 839, 0.78, 0.10, 80_000),
    ("UA-32", "Kyiv Oblast", None, "ua", 1.0, False, 1_780_000, 28_131, 0.74, 0.12, 120_000),
    ("UA-63", "Kharkiv", "city.kharkiv", "ua", 0.78, True, 2_590_000, 31_415, 0.62, 0.30, 380_000),
    ("UA-12", "Dnipropetrovsk", "city.dnipro", "ua", 1.0, False, 3_100_000, 31_923, 0.72, 0.16, 95_000),
    ("UA-14", "Donetsk", None, "ru", 0.18, True, 3_900_000, 26_517, 0.45, 0.55, 1_400_000),
    ("UA-09", "Luhansk", None, "ru", 0.05, True, 2_080_000, 26_684, 0.40, 0.60, 980_000),
    ("UA-23", "Zaporizhzhia", "city.zaporizhzhia", "ua", 0.55, True, 1_580_000, 27_180, 0.58, 0.36, 410_000),
    ("UA-65", "Kherson", "city.kherson", "ua", 0.62, True, 970_000, 28_461, 0.55, 0.40, 320_000),
    ("UA-43", "AR Crimea", "city.simferopol", "ru", 0.0, True, 1_950_000, 26_081, 0.35, 0.42, 60_000),
    ("UA-40", "Sevastopol City", "city.sevastopol", "ru", 0.0, True, 510_000, 864, 0.30, 0.30, 18_000),
    ("UA-48", "Mykolaiv", "city.mykolaiv", "ua", 1.0, False, 1_080_000, 24_598, 0.66, 0.22, 140_000),
    ("UA-51", "Odesa", "city.odesa", "ua", 1.0, False, 2_350_000, 33_310, 0.70, 0.18, 110_000),
    ("UA-46", "Lviv", "city.lviv", "ua", 1.0, False, 2_460_000, 21_833, 0.81, 0.08, 0),
    ("UA-26", "Ivano-Frankivsk", "city.ivano-frankivsk", "ua", 1.0, False, 1_350_000, 13_900, 0.78, 0.10, 0),
    ("UA-21", "Zakarpattia", "city.uzhhorod", "ua", 1.0, False, 1_240_000, 12_800, 0.74, 0.10, 0),
    ("UA-77", "Chernivtsi", "city.chernivtsi", "ua", 1.0, False, 890_000, 8_100, 0.72, 0.11, 0),
    ("UA-61", "Ternopil", "city.ternopil", "ua", 1.0, False, 1_030_000, 13_823, 0.78, 0.09, 0),
    ("UA-68", "Khmelnytskyi", "city.khmelnytskyi", "ua", 1.0, False, 1_240_000, 20_645, 0.76, 0.11, 0),
    ("UA-56", "Rivne", "city.rivne", "ua", 1.0, False, 1_140_000, 20_047, 0.77, 0.10, 0),
    ("UA-07", "Volyn", "city.lutsk", "ua", 1.0, False, 1_030_000, 20_144, 0.76, 0.11, 0),
    ("UA-18", "Zhytomyr", "city.zhytomyr", "ua", 1.0, False, 1_180_000, 29_832, 0.74, 0.13, 25_000),
    ("UA-74", "Chernihiv", "city.chernihiv", "ua", 0.96, True, 970_000, 31_865, 0.66, 0.20, 90_000),
    ("UA-59", "Sumy", "city.sumy", "ua", 0.92, True, 1_050_000, 23_834, 0.64, 0.22, 110_000),
    ("UA-53", "Poltava", "city.poltava", "ua", 1.0, False, 1_360_000, 28_748, 0.72, 0.14, 35_000),
    ("UA-71", "Cherkasy", "city.cherkasy", "ua", 1.0, False, 1_180_000, 20_900, 0.74, 0.12, 0),
    ("UA-35", "Kirovohrad", "city.kropyvnytskyi", "ua", 1.0, False, 920_000, 24_588, 0.73, 0.13, 0),
    ("UA-05", "Vinnytsia", "city.vinnytsia", "ua", 1.0, False, 1_510_000, 26_513, 0.76, 0.10, 0),
)

_OBLAST_ACTIONS = (
    "raise_curfew",
    "evacuate_civilians",
    "deploy_local_defence",
    "issue_air_raid_alert",
    "open_humanitarian_corridor",
)


def _add_oblasts(b: ScenarioBuilder) -> None:
    for (
        iso2,
        name,
        capital,
        faction,
        control,
        contested,
        population,
        area,
        morale,
        unrest,
        refugees,
    ) in _UA_OBLASTS:
        code = iso2.split("-", 1)[1]
        b.add_oblast(
            Oblast(
                id=f"obl.{code.lower()}",
                iso_3166_2=iso2,
                name=name,
                country_id="ua",
                faction_id=faction,
                capital_city_id=capital,
                population=population,
                area_km2=area,
                control=control,
                contested=contested,
                morale=morale,
                civil_unrest=unrest,
                refugees_outflow=refugees,
                available_actions=_OBLAST_ACTIONS,
            )
        )


# ---------------------------------------------------------------------------
# Territories: thin shells. Country fills come from Natural Earth client-side.
# We keep a minimal set so existing intel/region-id wiring still resolves.
# ---------------------------------------------------------------------------


def _add_territories(b: ScenarioBuilder) -> None:
    # Eastern Donbas pocket (RU-controlled): Donetsk + Luhansk shells.
    b.add_territory(
        "terr.donbas-occ", "Donbas (occupied)", "ru",
        ring=[
            (37.10, 49.30), (39.50, 49.40), (40.10, 48.40),
            (39.20, 47.30), (37.50, 47.10), (36.40, 47.65),
            (36.80, 48.40), (37.10, 49.30),
        ],
        control=0.92,
        country_id="ua",
    )
    # Crimea
    b.add_territory(
        "terr.crimea-occ", "Crimea (occupied)", "ru",
        ring=[
            (32.50, 46.00), (35.95, 45.95), (36.65, 45.30),
            (35.30, 44.40), (33.20, 44.40), (32.50, 45.40),
            (32.50, 46.00),
        ],
        control=1.0,
        country_id="ua",
    )
    # Zaporizhzhia / Kherson land bridge (partial)
    b.add_territory(
        "terr.south-occ", "Southern axis (occupied)", "ru",
        ring=[
            (33.10, 47.20), (35.60, 47.30), (36.80, 47.05),
            (36.95, 46.30), (35.20, 46.20), (33.30, 46.40),
            (33.10, 47.20),
        ],
        control=0.85,
        country_id="ua",
    )
    # Free Ukraine (rump)
    b.add_territory(
        "terr.ukraine-free", "Ukraine (rump)", "ua",
        ring=[
            (22.20, 52.30), (32.20, 52.30), (37.00, 49.90),
            (33.50, 47.40), (30.20, 46.20), (22.20, 48.20),
            (22.20, 52.30),
        ],
        control=1.0,
        country_id="ua",
    )


# ---------------------------------------------------------------------------
# Units (~150). Realism: named formations sourced from open ISW/MoD reports.
# Coordinates are forward-deployed approximate locations.
# ---------------------------------------------------------------------------


_UA_GROUND_ACTIONS = ("hold", "counter-attack", "withdraw", "request_fires", "rotate_to_rear")
_UA_AIR_ACTIONS = ("scramble_qra", "strike_package", "sead_mission", "stand_down")
_UA_NAV_ACTIONS = ("usv_strike", "convoy_escort", "port_defence")
_RU_GROUND_ACTIONS = ("attack", "consolidate", "displace", "request_fires", "fix_in_place")
_RU_AIR_ACTIONS = ("strike_package", "cap_mission", "kab_glide_strike", "stand_down")
_RU_NAV_ACTIONS = ("missile_strike", "patrol", "withdraw_eastward")


def _u(b: ScenarioBuilder, kind: UnitKind, uid: str, name: str, faction: str,
       lon: float, lat: float, str_: float, rdy: float, mor: float,
       country: str | None, actions: tuple[str, ...], call: str = "") -> None:
    b.add_unit(
        kind=kind, id=uid, name=name, faction_id=faction,
        lon=lon, lat=lat, strength=str_, readiness=rdy, morale=mor,
        callsign=call, country_id=country, available_actions=actions,
    )


def _add_units(b: ScenarioBuilder) -> None:
    # ----- Ukrainian ground formations (north → east → south) -----
    UA_GROUND = [
        # OK 'Pivnich' (Northern Command) - Chernihiv/Sumy/Kyiv axes
        ("unit.ua.gnd.1tank", "1st Sieverskyi Tank Brigade", UnitKind.ARMOURED_BRIGADE, 32.10, 51.40, 0.78, 0.74, 0.82, "VIKING-1"),
        ("unit.ua.gnd.61jaeg", "61st Stepova Jaeger Brigade", UnitKind.INFANTRY_BRIGADE, 33.95, 51.30, 0.72, 0.70, 0.78, "STEPPE"),
        ("unit.ua.gnd.41mech", "41st Mechanised Brigade", UnitKind.INFANTRY_BRIGADE, 34.20, 50.95, 0.74, 0.72, 0.80, "BUG"),
        ("unit.ua.gnd.116ter", "116th TerDef Brigade (Sumy)", UnitKind.INFANTRY_BRIGADE, 34.80, 50.92, 0.66, 0.62, 0.74, ""),
        ("unit.ua.gnd.119ter", "119th TerDef Brigade (Chernihiv)", UnitKind.INFANTRY_BRIGADE, 31.30, 51.50, 0.65, 0.60, 0.72, ""),
        # OK 'Skhid' (Eastern) - Kupiansk/Lyman/Bakhmut
        ("unit.ua.gnd.92mech", "92nd Mechanised Brigade", UnitKind.INFANTRY_BRIGADE, 37.55, 49.70, 0.70, 0.68, 0.76, "ZAPORIZH-92"),
        ("unit.ua.gnd.93mech", "93rd 'Kholodnyi Yar' Mech", UnitKind.INFANTRY_BRIGADE, 37.20, 48.60, 0.74, 0.72, 0.82, "YAR"),
        ("unit.ua.gnd.5tank", "5th Separate Tank Brigade", UnitKind.ARMOURED_BRIGADE, 37.75, 48.85, 0.72, 0.70, 0.78, "TIGR"),
        ("unit.ua.gnd.17tank", "17th Tank Brigade", UnitKind.ARMOURED_BRIGADE, 36.10, 48.45, 0.76, 0.74, 0.80, "KRYV"),
        ("unit.ua.gnd.4tank", "4th Tank Brigade", UnitKind.ARMOURED_BRIGADE, 35.95, 48.50, 0.74, 0.72, 0.78, ""),
        ("unit.ua.gnd.30mech", "30th 'Konstantyn Ostrozkyi' Mech", UnitKind.INFANTRY_BRIGADE, 37.85, 48.85, 0.70, 0.68, 0.76, ""),
        ("unit.ua.gnd.24mech", "24th 'Berdychivska' Mech", UnitKind.INFANTRY_BRIGADE, 37.95, 48.55, 0.74, 0.72, 0.80, ""),
        ("unit.ua.gnd.10mtn", "10th Mountain Assault Bde 'Edelweiss'", UnitKind.INFANTRY_BRIGADE, 37.95, 48.20, 0.78, 0.76, 0.84, "EDEL"),
        ("unit.ua.gnd.110mech", "110th Mechanised Brigade", UnitKind.INFANTRY_BRIGADE, 37.74, 48.13, 0.62, 0.60, 0.70, ""),
        ("unit.ua.gnd.53mech", "53rd Mech 'Volynska Sich'", UnitKind.INFANTRY_BRIGADE, 37.70, 47.85, 0.70, 0.68, 0.74, ""),
        ("unit.ua.gnd.54mech", "54th 'Pokrovskyi' Mech", UnitKind.INFANTRY_BRIGADE, 37.20, 49.15, 0.72, 0.70, 0.76, ""),
        ("unit.ua.gnd.66mech", "66th Mechanised Brigade", UnitKind.INFANTRY_BRIGADE, 37.45, 49.10, 0.68, 0.66, 0.74, ""),
        ("unit.ua.gnd.115mech", "115th Mechanised Brigade", UnitKind.INFANTRY_BRIGADE, 38.10, 49.00, 0.66, 0.64, 0.72, ""),
        # Air assault / SSO
        ("unit.ua.gnd.25aslt", "25th Airborne Brigade 'Sicheslav'", UnitKind.INFANTRY_BRIGADE, 37.50, 48.65, 0.78, 0.76, 0.86, "SICH"),
        ("unit.ua.gnd.79aslt", "79th Air Assault Brigade", UnitKind.INFANTRY_BRIGADE, 37.20, 48.10, 0.80, 0.78, 0.86, "MARTLET"),
        ("unit.ua.gnd.80aslt", "80th Air Assault Brigade 'Lviv'", UnitKind.INFANTRY_BRIGADE, 37.55, 48.50, 0.82, 0.80, 0.88, "LVIV"),
        ("unit.ua.gnd.81aslt", "81st Airmobile Brigade 'Sloboda'", UnitKind.INFANTRY_BRIGADE, 37.40, 48.95, 0.78, 0.76, 0.84, "SLOBODA"),
        ("unit.ua.gnd.82aslt", "82nd Air Assault Brigade", UnitKind.INFANTRY_BRIGADE, 35.40, 47.55, 0.80, 0.78, 0.84, "BUFFALO"),
        ("unit.ua.gnd.95aslt", "95th 'Polissia' Air Assault", UnitKind.INFANTRY_BRIGADE, 37.30, 48.30, 0.80, 0.78, 0.86, "POLISSIA"),
        # OK 'Pivden' (Southern) - Zaporizhzhia / Kherson
        ("unit.ua.gnd.65mech", "65th Mechanised Brigade", UnitKind.INFANTRY_BRIGADE, 35.90, 47.45, 0.72, 0.70, 0.78, ""),
        ("unit.ua.gnd.118mech", "118th Mechanised Brigade", UnitKind.INFANTRY_BRIGADE, 35.55, 47.30, 0.66, 0.64, 0.72, ""),
        ("unit.ua.gnd.128mtn", "128th Mountain Assault Bde", UnitKind.INFANTRY_BRIGADE, 35.40, 47.40, 0.74, 0.72, 0.80, "TRANS"),
        ("unit.ua.gnd.33mech", "33rd Mechanised Brigade", UnitKind.INFANTRY_BRIGADE, 35.70, 47.50, 0.68, 0.66, 0.74, ""),
        ("unit.ua.gnd.46aslt", "46th Airmobile Brigade", UnitKind.INFANTRY_BRIGADE, 35.35, 47.65, 0.74, 0.72, 0.80, ""),
        ("unit.ua.gnd.47mech", "47th 'Magura' Mech (M2 Bradleys)", UnitKind.INFANTRY_BRIGADE, 35.85, 47.40, 0.78, 0.76, 0.82, "MAGURA"),
        ("unit.ua.gnd.59motor", "59th Motorised Brigade", UnitKind.INFANTRY_BRIGADE, 32.50, 46.85, 0.66, 0.64, 0.72, ""),
        ("unit.ua.gnd.60inf", "60th Infantry Brigade", UnitKind.INFANTRY_BRIGADE, 32.85, 46.95, 0.62, 0.60, 0.70, ""),
        ("unit.ua.gnd.36mar", "36th Marine Brigade", UnitKind.INFANTRY_BRIGADE, 32.20, 46.75, 0.72, 0.70, 0.78, "ALBATROS"),
        ("unit.ua.gnd.35mar", "35th Marine Brigade", UnitKind.INFANTRY_BRIGADE, 32.00, 46.95, 0.70, 0.68, 0.76, ""),
        ("unit.ua.gnd.37mar", "37th Marine Brigade", UnitKind.INFANTRY_BRIGADE, 31.80, 46.85, 0.68, 0.66, 0.74, ""),
        ("unit.ua.gnd.38mar", "38th Marine Brigade", UnitKind.INFANTRY_BRIGADE, 31.50, 46.70, 0.66, 0.64, 0.72, ""),
        # OK 'Zakhid' (Western) - reserves / training
        ("unit.ua.gnd.14mech", "14th 'Prince Roman the Great' Mech", UnitKind.INFANTRY_BRIGADE, 26.30, 50.10, 0.78, 0.76, 0.84, ""),
        ("unit.ua.gnd.100ter", "100th TerDef Brigade (Lviv)", UnitKind.INFANTRY_BRIGADE, 24.05, 49.80, 0.68, 0.62, 0.78, ""),
        ("unit.ua.gnd.101ter", "101st TerDef Brigade (Vol)", UnitKind.INFANTRY_BRIGADE, 25.34, 50.74, 0.66, 0.60, 0.76, ""),
        ("unit.ua.gnd.102ter", "102nd TerDef Brigade (IF)", UnitKind.INFANTRY_BRIGADE, 24.71, 48.92, 0.66, 0.60, 0.76, ""),
        # National Guard / NGU
        ("unit.ua.gnd.1ngu", "1st 'Bureviy' Operational Brigade", UnitKind.INFANTRY_BRIGADE, 36.00, 50.40, 0.72, 0.70, 0.78, "BUREVIY"),
        ("unit.ua.gnd.4ngu", "4th 'Rubizh' Brigade", UnitKind.INFANTRY_BRIGADE, 30.55, 50.45, 0.72, 0.70, 0.78, "RUBIZH"),
        ("unit.ua.gnd.azov", "12th 'Azov' Brigade", UnitKind.INFANTRY_BRIGADE, 37.40, 49.40, 0.78, 0.76, 0.86, "AZOV"),
        # SSO
        ("unit.ua.gnd.140sso", "140th SOF Centre", UnitKind.INFANTRY_BRIGADE, 24.05, 49.85, 0.82, 0.80, 0.88, ""),
        ("unit.ua.gnd.3sso", "3rd SOF Regiment", UnitKind.INFANTRY_BRIGADE, 30.55, 50.40, 0.84, 0.82, 0.88, ""),
        ("unit.ua.gnd.8sso", "8th SOF Regiment", UnitKind.INFANTRY_BRIGADE, 28.45, 49.20, 0.82, 0.80, 0.86, ""),
        # Border guard battle groups
        ("unit.ua.gnd.dpsu-n", "DPSU North BG", UnitKind.INFANTRY_BRIGADE, 31.30, 51.60, 0.62, 0.58, 0.70, ""),
        ("unit.ua.gnd.dpsu-e", "DPSU East BG", UnitKind.INFANTRY_BRIGADE, 36.50, 49.95, 0.62, 0.58, 0.70, ""),
    ]
    for uid, name, kind, lon, lat, s, r, m, call in UA_GROUND:
        _u(b, kind, uid, name, "ua", lon, lat, s, r, m, "ua", _UA_GROUND_ACTIONS, call)

    # ----- Ukrainian Air -----
    UA_AIR = [
        ("unit.ua.air.40bav", "40th Tactical Aviation Brigade (MiG-29)", 30.32, 50.24, 0.70, 0.68, 0.78, "VITER"),
        ("unit.ua.air.831bav", "831st Tactical Aviation Bde (Su-27)", 28.51, 49.20, 0.68, 0.66, 0.76, "MYRNYI"),
        ("unit.ua.air.299bav", "299th Tactical Aviation Bde (Su-25)", 30.32, 50.20, 0.66, 0.64, 0.72, "GRACH-UA"),
        ("unit.ua.air.f16-1", "F-16 Detachment Alpha", 27.24, 49.76, 0.78, 0.76, 0.84, "FALCON"),
        ("unit.ua.air.7tab", "7th Tactical Aviation Bde (Su-24M)", 27.24, 49.76, 0.66, 0.64, 0.70, "FENCER"),
        ("unit.ua.air.96sam", "96th SAM Bde (S-300)", 30.50, 50.45, 0.72, 0.70, 0.78, "BARYER"),
        ("unit.ua.air.156sam", "156th SAM Bde (Patriot)", 30.50, 50.40, 0.84, 0.82, 0.88, "PATRIOT-1"),
        ("unit.ua.air.540sam", "540th SAM Regt (NASAMS)", 36.20, 49.95, 0.78, 0.76, 0.82, ""),
        ("unit.ua.air.uav-1", "Achilles UAV Strike Battalion", 37.40, 48.40, 0.84, 0.82, 0.88, "ACHILLES"),
    ]
    for uid, name, lon, lat, s, r, m, call in UA_AIR:
        _u(b, UnitKind.AIR_WING, uid, name, "ua", lon, lat, s, r, m, "ua", _UA_AIR_ACTIONS, call)

    # ----- Ukrainian Naval -----
    UA_NAV = [
        ("unit.ua.nav.gur-13", "GUR Group 13 (USV)", 30.72, 46.40, 0.86, 0.84, 0.90, "MAGURA"),
        ("unit.ua.nav.odesa", "Odesa Naval Defence Group", 30.75, 46.40, 0.72, 0.70, 0.78, "ANCHOR-UA"),
        ("unit.ua.nav.danube", "Danube Flotilla", 28.85, 45.45, 0.66, 0.64, 0.72, ""),
    ]
    for uid, name, lon, lat, s, r, m, call in UA_NAV:
        _u(b, UnitKind.NAVAL_TASK_GROUP, uid, name, "ua", lon, lat, s, r, m, "ua", _UA_NAV_ACTIONS, call)

    # ----- Russian ground formations -----
    RU_GROUND = [
        # GoF North (Belgorod / Bryansk / Kursk)
        ("unit.ru.gnd.1ta", "1st Guards Tank Army HQ Det", UnitKind.ARMOURED_BRIGADE, 36.60, 50.60, 0.74, 0.72, 0.66, "ZAPAD"),
        ("unit.ru.gnd.4tank", "4th Guards Tank Division (Kantemirovskaya)", UnitKind.ARMOURED_BRIGADE, 36.20, 50.95, 0.72, 0.70, 0.64, "KANT"),
        ("unit.ru.gnd.2tamd", "2nd Guards Motor Rifle Div (Tamanskaya)", UnitKind.INFANTRY_BRIGADE, 36.85, 51.10, 0.70, 0.68, 0.62, "TAMAN"),
        ("unit.ru.gnd.144gmrd", "144th Guards Motor Rifle Div", UnitKind.INFANTRY_BRIGADE, 34.40, 53.20, 0.72, 0.70, 0.64, ""),
        ("unit.ru.gnd.448mrb", "448th Missile Brigade (Iskander)", UnitKind.ARMOURED_BRIGADE, 34.40, 52.95, 0.84, 0.82, 0.74, "ISKANDER-N"),
        ("unit.ru.gnd.155marm", "155th Naval Infantry (PF, attached)", UnitKind.INFANTRY_BRIGADE, 36.50, 50.60, 0.66, 0.64, 0.58, "POLAR"),
        ("unit.ru.gnd.27mrb", "27th Sep Guards Motor Rifle Bde", UnitKind.INFANTRY_BRIGADE, 36.60, 50.85, 0.70, 0.68, 0.62, ""),
        ("unit.ru.gnd.18mrb", "18th Motor Rifle Brigade", UnitKind.INFANTRY_BRIGADE, 35.80, 51.50, 0.68, 0.66, 0.60, ""),
        ("unit.ru.gnd.20cad", "20th CAA HQ Det", UnitKind.INFANTRY_BRIGADE, 39.20, 51.65, 0.72, 0.70, 0.62, "VORONEZH"),
        # 1st Tank Army legacy units around Voronezh
        ("unit.ru.gnd.6cad", "6th CAA HQ Det", UnitKind.INFANTRY_BRIGADE, 30.30, 59.95, 0.72, 0.70, 0.64, ""),
        # GoF Centre (Kupiansk-Lyman) - 25th CAA / 41st CAA
        ("unit.ru.gnd.25cad", "25th CAA HQ Det", UnitKind.INFANTRY_BRIGADE, 38.70, 49.50, 0.70, 0.68, 0.62, ""),
        ("unit.ru.gnd.20mrb", "20th Guards Motor Rifle Div", UnitKind.INFANTRY_BRIGADE, 38.20, 49.30, 0.68, 0.66, 0.60, ""),
        ("unit.ru.gnd.41cad", "41st CAA HQ Det", UnitKind.INFANTRY_BRIGADE, 37.75, 49.10, 0.70, 0.68, 0.62, "URAL"),
        ("unit.ru.gnd.74mrb", "74th Sep Motor Rifle Bde", UnitKind.INFANTRY_BRIGADE, 38.05, 49.40, 0.66, 0.64, 0.58, ""),
        ("unit.ru.gnd.35mrb", "35th Sep Guards Motor Rifle Bde", UnitKind.INFANTRY_BRIGADE, 37.50, 49.10, 0.68, 0.66, 0.60, ""),
        # GoF South (Donetsk axis) - 8th CAA
        ("unit.ru.gnd.8cad", "8th CAA HQ Det", UnitKind.INFANTRY_BRIGADE, 38.50, 47.85, 0.74, 0.72, 0.66, "DON"),
        ("unit.ru.gnd.150mrd", "150th Motor Rifle Division", UnitKind.INFANTRY_BRIGADE, 37.85, 47.95, 0.70, 0.68, 0.62, ""),
        ("unit.ru.gnd.20mrd", "20th Guards Motor Rifle Division", UnitKind.INFANTRY_BRIGADE, 37.95, 48.10, 0.68, 0.66, 0.60, ""),
        ("unit.ru.gnd.5tnkdn", "5th Sep Tank Brigade (DPR-int)", UnitKind.ARMOURED_BRIGADE, 37.80, 48.00, 0.66, 0.64, 0.58, ""),
        ("unit.ru.gnd.1afk", "1st AFK 'DNR' (consolidated)", UnitKind.INFANTRY_BRIGADE, 37.85, 48.10, 0.62, 0.60, 0.56, ""),
        ("unit.ru.gnd.2afk", "2nd AFK 'LNR' (consolidated)", UnitKind.INFANTRY_BRIGADE, 39.05, 48.55, 0.62, 0.60, 0.56, ""),
        # GoF Dnipro / Tavria (Zaporizhzhia / Kherson)
        ("unit.ru.gnd.58cad", "58th CAA HQ Det", UnitKind.INFANTRY_BRIGADE, 35.90, 47.10, 0.74, 0.72, 0.64, "TAVRIDA"),
        ("unit.ru.gnd.42mrd", "42nd Guards Motor Rifle Division", UnitKind.INFANTRY_BRIGADE, 36.50, 47.30, 0.68, 0.66, 0.60, ""),
        ("unit.ru.gnd.19mrd", "19th Motor Rifle Division", UnitKind.INFANTRY_BRIGADE, 35.50, 47.20, 0.66, 0.64, 0.58, ""),
        ("unit.ru.gnd.291mrr", "291st Motor Rifle Regiment", UnitKind.INFANTRY_BRIGADE, 36.10, 47.20, 0.64, 0.62, 0.56, ""),
        ("unit.ru.gnd.503mrr", "503rd Motor Rifle Regiment", UnitKind.INFANTRY_BRIGADE, 35.80, 46.95, 0.64, 0.62, 0.56, ""),
        ("unit.ru.gnd.247vdv", "247th Guards Air Assault Regiment", UnitKind.INFANTRY_BRIGADE, 35.60, 47.60, 0.74, 0.72, 0.66, "BLUE"),
        ("unit.ru.gnd.7vdv", "7th Guards Mountain Air Assault Div", UnitKind.INFANTRY_BRIGADE, 35.50, 46.95, 0.74, 0.72, 0.68, "DESANT"),
        ("unit.ru.gnd.76vdv", "76th Guards Air Assault Division", UnitKind.INFANTRY_BRIGADE, 38.20, 49.20, 0.74, 0.72, 0.68, "PSKOV"),
        ("unit.ru.gnd.106vdv", "106th Guards Airborne Division", UnitKind.INFANTRY_BRIGADE, 37.20, 48.15, 0.74, 0.72, 0.68, "TULA"),
        ("unit.ru.gnd.98vdv", "98th Guards Airborne Division", UnitKind.INFANTRY_BRIGADE, 36.00, 47.30, 0.72, 0.70, 0.66, ""),
        # 49th CAA / Krasnodar reserves
        ("unit.ru.gnd.49cad", "49th CAA HQ Det", UnitKind.INFANTRY_BRIGADE, 38.97, 45.04, 0.74, 0.72, 0.66, ""),
        ("unit.ru.gnd.34mrb", "34th Mountain Motor Rifle Bde", UnitKind.INFANTRY_BRIGADE, 39.10, 45.05, 0.70, 0.68, 0.62, ""),
        # Crimea garrison (22nd AC)
        ("unit.ru.gnd.22ac", "22nd Army Corps HQ Det", UnitKind.INFANTRY_BRIGADE, 34.10, 45.05, 0.72, 0.70, 0.66, "CRIMEA"),
        ("unit.ru.gnd.126cdb", "126th Coastal Def Bde", UnitKind.INFANTRY_BRIGADE, 33.55, 44.62, 0.70, 0.68, 0.64, ""),
        ("unit.ru.gnd.810nim", "810th Naval Infantry Brigade", UnitKind.INFANTRY_BRIGADE, 33.55, 44.62, 0.74, 0.72, 0.68, "BLACK-NI"),
        ("unit.ru.gnd.40nim", "40th Naval Infantry Brigade (Pacific, det)", UnitKind.INFANTRY_BRIGADE, 35.20, 47.10, 0.66, 0.64, 0.58, ""),
        # Strategic / theatre-level
        ("unit.ru.gnd.1gtb", "1st Gds Tank Bde (Wagner-successor)", UnitKind.ARMOURED_BRIGADE, 38.10, 48.85, 0.62, 0.60, 0.54, "ORK-1"),
        ("unit.ru.gnd.afrika", "Africa Corps reserve detachment", UnitKind.INFANTRY_BRIGADE, 37.90, 47.10, 0.58, 0.56, 0.52, ""),
    ]
    for uid, name, kind, lon, lat, s, r, m, call in RU_GROUND:
        _u(b, kind, uid, name, "ru", lon, lat, s, r, m, "ru", _RU_GROUND_ACTIONS, call)

    # ----- Russian Air -----
    RU_AIR = [
        ("unit.ru.air.4pvo", "4th Air & Air Defence Army HQ", 39.20, 51.65, 0.78, 0.76, 0.70, "VKS-S"),
        ("unit.ru.air.6pvo", "6th Air & Air Defence Army (Western MD)", 30.30, 59.85, 0.78, 0.76, 0.72, ""),
        ("unit.ru.air.105gs", "105th Mixed Aviation Division", 36.20, 51.70, 0.74, 0.72, 0.66, ""),
        ("unit.ru.air.4apib", "4th Bomber Aviation Regiment (Su-34)", 39.20, 51.55, 0.74, 0.72, 0.66, "FENCER-RU"),
        ("unit.ru.air.morozovsk", "559th Bomber Air Regt 'Morozovsk'", 41.85, 48.35, 0.70, 0.68, 0.62, ""),
        ("unit.ru.air.engels", "121st Heavy Bomber Regiment (Tu-160)", 46.21, 51.48, 0.74, 0.72, 0.68, "ENGELS"),
        ("unit.ru.air.31giap", "31st GIAP (Su-35S, Millerovo)", 40.40, 48.95, 0.74, 0.72, 0.66, ""),
        ("unit.ru.air.s400-w", "S-400 Regiment (Western MD)", 36.50, 50.55, 0.84, 0.82, 0.76, "TRIUMF-W"),
        ("unit.ru.air.s400-s", "S-400 Regiment (Crimea)", 33.95, 44.90, 0.82, 0.80, 0.74, "TRIUMF-S"),
        ("unit.ru.air.s500", "S-500 Regiment (Moscow)", 37.60, 55.75, 0.78, 0.76, 0.70, "PROMETEY"),
        ("unit.ru.air.uav-r", "Forpost / Lancet UAV Group", 38.50, 47.85, 0.74, 0.72, 0.66, ""),
    ]
    for uid, name, lon, lat, s, r, m, call in RU_AIR:
        _u(b, UnitKind.AIR_WING, uid, name, "ru", lon, lat, s, r, m, "ru", _RU_AIR_ACTIONS, call)

    # ----- Russian Naval -----
    RU_NAV = [
        ("unit.ru.nav.bsf-sag", "Black Sea Fleet SAG", 37.10, 44.10, 0.70, 0.68, 0.62, "BSF-SAG"),
        ("unit.ru.nav.bsf-ssk", "Improved Kilo SSK Group", 37.50, 43.85, 0.74, 0.72, 0.66, ""),
        ("unit.ru.nav.bsf-cor", "Buyan-M / Karakurt Strike Group", 37.20, 44.30, 0.78, 0.76, 0.72, "KALIBR-BSF"),
        ("unit.ru.nav.cas-cor", "Caspian Flotilla Strike Group", 47.95, 42.97, 0.70, 0.68, 0.64, "KASPIAN"),
    ]
    for uid, name, lon, lat, s, r, m, call in RU_NAV:
        _u(b, UnitKind.NAVAL_TASK_GROUP, uid, name, "ru", lon, lat, s, r, m, "ru", _RU_NAV_ACTIONS, call)

    # ----- Belarus -----
    BY_GROUND = [
        ("unit.by.gnd.6mrb", "6th Sep Guards Mech Bde", UnitKind.INFANTRY_BRIGADE, 27.45, 53.85, 0.62, 0.60, 0.62, ""),
        ("unit.by.gnd.11mrb", "11th Sep Guards Mech Bde", UnitKind.INFANTRY_BRIGADE, 23.85, 53.65, 0.60, 0.58, 0.60, ""),
        ("unit.by.gnd.103aslt", "103rd Vitebsk Airmobile Bde", UnitKind.INFANTRY_BRIGADE, 30.20, 55.20, 0.66, 0.64, 0.66, ""),
        ("unit.by.gnd.38aslt", "38th Brest Airmobile Bde", UnitKind.INFANTRY_BRIGADE, 23.73, 52.10, 0.64, 0.62, 0.64, ""),
        ("unit.by.air.61atb", "61st Fighter Air Base (Su-30SM)", UnitKind.AIR_WING, 26.05, 53.10, 0.68, 0.66, 0.66, ""),
        ("unit.by.air.116ab", "116th Bomber Air Base (Lida)", UnitKind.AIR_WING, 25.37, 53.89, 0.62, 0.60, 0.62, ""),
        ("unit.by.air.s400", "S-400 Detachment (RU-detached)", UnitKind.AIR_WING, 28.64, 53.30, 0.78, 0.76, 0.70, ""),
    ]
    for uid, name, kind, lon, lat, s, r, m, _call in BY_GROUND:
        actions = _RU_AIR_ACTIONS if kind == UnitKind.AIR_WING else _RU_GROUND_ACTIONS
        _u(b, kind, uid, name, "ru", lon, lat, s, r, m, "by", actions, _call)


# ---------------------------------------------------------------------------
# Static logistics
# ---------------------------------------------------------------------------


def _add_depots(b: ScenarioBuilder) -> None:
    rows = [
        # Ukrainian rear depots (deep west / centre)
        ("dep.ua.lviv", "Lviv Logistics Hub", "ua", 24.05, 49.85, 0.85, 0.78, "ua"),
        ("dep.ua.dnipro", "Dnipro Sustainment Node", "ua", 35.05, 48.46, 0.78, 0.62, "ua"),
        ("dep.ua.poltava", "Poltava Forward Depot", "ua", 34.55, 49.59, 0.70, 0.55, "ua"),
        ("dep.ua.kharkiv", "Kharkiv Forward Stockpile", "ua", 36.20, 49.95, 0.65, 0.42, "ua"),
        ("dep.ua.zaporizhzhia", "Zaporizhzhia Field Depot", "ua", 35.14, 47.84, 0.60, 0.48, "ua"),
        ("dep.ua.mykolaiv", "Mykolaiv Naval Sustainment", "ua", 31.99, 46.97, 0.55, 0.40, "ua"),
        ("dep.ua.zhytomyr", "Zhytomyr Reserve Depot", "ua", 28.66, 50.25, 0.72, 0.65, "ua"),
        ("dep.ua.vinnytsia", "Vinnytsia Air Logistics", "ua", 28.46, 49.23, 0.70, 0.62, "ua"),
        # Russian rear / forward depots
        ("dep.ru.belgorod", "Belgorod Forward Stockpile", "ru", 36.55, 50.55, 0.80, 0.70, "ru"),
        ("dep.ru.voronezh", "Voronezh Strategic Depot", "ru", 39.20, 51.65, 0.90, 0.80, "ru"),
        ("dep.ru.rostov", "Rostov Sustainment Hub", "ru", 39.72, 47.24, 0.92, 0.78, "ru"),
        ("dep.ru.kursk", "Kursk Field Depot", "ru", 36.18, 51.70, 0.78, 0.66, "ru"),
        ("dep.ru.mariupol", "Mariupol Forward Depot", "ru", 37.55, 47.10, 0.70, 0.62, "ua"),
        ("dep.ru.dzhankoi", "Dzhankoi Rail Depot (Crimea)", "ru", 34.40, 45.71, 0.80, 0.65, "ua"),
        ("dep.ru.taganrog", "Taganrog POL Hub", "ru", 38.92, 47.24, 0.74, 0.62, "ru"),
        # Belarusian
        ("dep.by.asipovichy", "Asipovichy 1405 Storage", "ru", 28.64, 53.30, 0.78, 0.70, "by"),
        ("dep.by.gomel", "Gomel Logistics Node", "ru", 30.98, 52.42, 0.65, 0.58, "by"),
    ]
    for did, name, fac, lon, lat, cap, fill, country in rows:
        b.add_depot(
            id=did, name=name, faction_id=fac, lon=lon, lat=lat,
            capacity=cap, fill=fill, country_id=country,
            available_actions=("strike", "interdict", "resupply"),
        )


def _add_airfields(b: ScenarioBuilder) -> None:
    rows = [
        # UA
        ("af.ua.vasylkiv", "Vasylkiv AB", "ua", 30.32, 50.24, 3000, "tactical", 18, "ua"),
        ("af.ua.starokost", "Starokostiantyniv AB", "ua", 27.24, 49.76, 3500, "tactical", 22, "ua"),
        ("af.ua.kulbakino", "Kulbakino AB (Mykolaiv)", "ua", 32.05, 46.92, 2500, "tactical", 8, "ua"),
        ("af.ua.dolgintsevo", "Dolgintsevo AB (Kryvyi Rih)", "ua", 33.46, 47.91, 2700, "tactical", 10, "ua"),
        ("af.ua.zhytomyr", "Ozerne AB (Zhytomyr)", "ua", 28.74, 50.16, 3000, "tactical", 12, "ua"),
        ("af.ua.kolomyia", "Kolomyia AB", "ua", 25.06, 48.51, 2500, "dispersal", 4, "ua"),
        ("af.ua.lvivAB", "Lviv International (mil-civ)", "ua", 23.96, 49.81, 3300, "civilian", 6, "ua"),
        ("af.ua.boryspil", "Boryspil (mil-civ)", "ua", 30.89, 50.34, 4000, "civilian", 0, "ua"),
        # RU
        ("af.ru.belbek", "Belbek AB (Crimea)", "ru", 33.57, 44.69, 3500, "tactical", 24, "ua"),
        ("af.ru.saki", "Saki / Novofedorivka AB (Crimea)", "ru", 33.58, 45.09, 3300, "tactical", 18, "ua"),
        ("af.ru.gvardeyskoye", "Gvardeyskoye AB (Crimea)", "ru", 34.03, 45.10, 3500, "tactical", 16, "ua"),
        ("af.ru.dzhankoi", "Dzhankoi AB (Crimea)", "ru", 34.39, 45.69, 3500, "tactical", 10, "ua"),
        ("af.ru.kacha", "Kacha NA Air Base (Crimea)", "ru", 33.55, 44.79, 3000, "tactical", 12, "ua"),
        ("af.ru.berdyansk", "Berdyansk AB", "ru", 36.74, 46.81, 2800, "tactical", 8, "ua"),
        ("af.ru.taganrog", "Taganrog Beriev (mil-civ)", "ru", 38.85, 47.20, 3500, "strategic", 6, "ru"),
        ("af.ru.morozovsk", "Morozovsk AB (Su-34)", "ru", 41.79, 48.32, 3500, "tactical", 24, "ru"),
        ("af.ru.engels2", "Engels-2 Strategic AB", "ru", 46.21, 51.48, 3500, "strategic", 22, "ru"),
        ("af.ru.kursk", "Khalino AB (Kursk)", "ru", 36.30, 51.75, 3500, "tactical", 18, "ru"),
        ("af.ru.belgorod", "Belgorod AB", "ru", 36.59, 50.64, 2800, "tactical", 10, "ru"),
        ("af.ru.voronezh", "Voronezh-Baltimor AB", "ru", 39.13, 51.62, 3500, "tactical", 22, "ru"),
        ("af.ru.shaykovka", "Shaykovka AB (Tu-22M3)", "ru", 33.95, 54.27, 3500, "strategic", 14, "ru"),
        ("af.ru.olenya", "Olenya Strategic AB", "ru", 33.46, 68.15, 3500, "strategic", 16, "ru"),
        # BY
        ("af.by.baranavichy", "Baranavichy AB", "ru", 26.05, 53.10, 3500, "tactical", 18, "by"),
        ("af.by.lida", "Lida AB", "ru", 25.37, 53.89, 3000, "tactical", 12, "by"),
        ("af.by.machulishchy", "Machulishchy AB", "ru", 27.51, 53.78, 3300, "strategic", 6, "by"),
    ]
    for aid, name, fac, lon, lat, rwy, role, ba, country in rows:
        b.add_airfield(
            id=aid, name=name, faction_id=fac, lon=lon, lat=lat,
            runway_m=rwy, role=role, based_aircraft=ba, country_id=country,
            available_actions=("strike", "interdict", "scramble"),
        )


def _add_naval_bases(b: ScenarioBuilder) -> None:
    rows = [
        ("nb.ua.odesa", "Odesa Naval Base", "ua", 30.74, 46.50, 6, ("unit.ua.nav.odesa",), "ua"),
        ("nb.ua.izmail", "Izmail / Danube Flotilla Base", "ua", 28.85, 45.34, 4, ("unit.ua.nav.danube",), "ua"),
        ("nb.ru.sevastopol", "Sevastopol Main Base", "ru", 33.53, 44.62, 14,
            ("unit.ru.nav.bsf-sag", "unit.ru.nav.bsf-ssk"), "ua"),
        ("nb.ru.novorossiysk", "Novorossiysk Naval Base", "ru", 37.78, 44.72, 8,
            ("unit.ru.nav.bsf-cor",), "ru"),
        ("nb.ru.feodosia", "Feodosia Naval Sub-Base", "ru", 35.39, 45.04, 4, (), "ua"),
        ("nb.ru.kaspiysk", "Kaspiysk (Caspian Flotilla)", "ru", 47.65, 42.88, 6,
            ("unit.ru.nav.cas-cor",), "ru"),
    ]
    for nbid, name, fac, lon, lat, piers, units, country in rows:
        b.add_naval_base(
            id=nbid, name=name, faction_id=fac, lon=lon, lat=lat,
            pier_count=piers, home_port_for=units, country_id=country,
            available_actions=("strike", "blockade", "patrol"),
        )


def _add_border_crossings(b: ScenarioBuilder) -> None:
    rows = [
        ("bc.medyka", "Medyka / Shehyni (PL-UA)", "ua", 22.92, 49.81, ("ua", "by"), "open", True, True),  # placeholder neighbour
        ("bc.korczowa", "Korczowa / Krakovets", "ua", 23.13, 49.95, ("ua", "by"), "open", False, True),
        ("bc.uzhhorod", "Uzhhorod / Vysne Nemecke (SK-UA)", "ua", 22.30, 48.62, ("ua", "by"), "open", True, True),
        ("bc.dorohusk", "Dorohusk / Yahodyn (PL-UA)", "ua", 23.83, 51.16, ("ua", "by"), "open", True, True),
        ("bc.palanca", "Palanca (UA-MD)", "ua", 30.13, 46.05, ("ua", "by"), "open", False, True),
        ("bc.mohyliv", "Mohyliv-Podilskyi (UA-MD)", "ua", 27.79, 48.45, ("ua", "by"), "open", True, True),
        ("bc.brest-tere", "Terespol / Brest (PL-BY)", "ru", 23.65, 52.07, ("by", "by"), "restricted", True, True),
        ("bc.benyakoni", "Benyakoni (BY-LT)", "ru", 25.50, 54.30, ("by", "by"), "restricted", False, True),
        ("bc.kotlovka", "Kotlovka (BY-LT)", "ru", 26.42, 54.40, ("by", "by"), "closed", False, True),
        ("bc.bachevsk", "Bachevsk (UA-RU, North)", "ua", 34.44, 52.30, ("ua", "ru"), "closed", False, True),
        ("bc.hoptivka", "Hoptivka / Nekhoteevka (UA-RU, Kharkiv)", "ru", 36.34, 50.37, ("ua", "ru"), "closed", False, True),
        ("bc.izvarino", "Izvarino (UA-RU, Luhansk)", "ru", 39.92, 48.63, ("ua", "ru"), "closed", False, True),
    ]
    # We override neighbour pairs to be valid country pairs
    valid_pairs = {
        "bc.medyka": ("ua", "ua"),  # inside UA at PL border; we don't model PL as a country
        "bc.korczowa": ("ua", "ua"),
        "bc.uzhhorod": ("ua", "ua"),
        "bc.dorohusk": ("ua", "ua"),
        "bc.palanca": ("ua", "ua"),
        "bc.mohyliv": ("ua", "ua"),
        "bc.brest-tere": ("by", "by"),
        "bc.benyakoni": ("by", "by"),
        "bc.kotlovka": ("by", "by"),
        "bc.bachevsk": ("ua", "ru"),
        "bc.hoptivka": ("ua", "ru"),
        "bc.izvarino": ("ua", "ru"),
    }
    for bcid, name, fac, lon, lat, _pair, mode, rail, road in rows:
        b.add_border_crossing(
            id=bcid, name=name, faction_id=fac, lon=lon, lat=lat,
            countries=valid_pairs[bcid],
            mode=mode, rail=rail, road=road,
            available_actions=("close", "reinforce", "demine"),
        )


def _add_supply_lines(b: ScenarioBuilder) -> None:
    rows = [
        # UA western trunk: Lviv -> Vinnytsia -> Dnipro -> Pokrovsk corridor
        ("sl.ua.west-east-1", "Lviv → Kyiv → Dnipro Trunk", "ua",
            [(24.05, 49.85), (28.45, 49.20), (30.55, 50.45), (32.05, 49.45), (35.05, 48.46)], 0.78, "rail"),
        ("sl.ua.dnipro-east", "Dnipro → Pokrovsk Forward", "ua",
            [(35.05, 48.46), (36.10, 48.55), (37.20, 48.55)], 0.62, "road"),
        ("sl.ua.kharkiv", "Poltava → Kharkiv Forward", "ua",
            [(34.55, 49.59), (35.50, 49.85), (36.20, 49.95)], 0.55, "road"),
        ("sl.ua.south", "Mykolaiv → Kherson Coastal", "ua",
            [(31.99, 46.97), (32.40, 46.85), (32.62, 46.64)], 0.50, "road"),
        ("sl.ua.zap-front", "Zaporizhzhia → Robotyne Forward", "ua",
            [(35.14, 47.84), (35.65, 47.50), (35.85, 47.40)], 0.45, "road"),
        ("sl.ua.import-pl", "PL Border → Lviv Logistics", "ua",
            [(22.92, 49.81), (23.50, 49.83), (24.05, 49.85)], 0.85, "road"),
        ("sl.ua.import-ro", "RO Border → Odesa", "ua",
            [(28.85, 45.45), (30.20, 46.10), (30.74, 46.50)], 0.74, "road"),
        # RU trunk routes
        ("sl.ru.belgorod-fwd", "Belgorod → Volchansk Forward", "ru",
            [(36.55, 50.55), (37.10, 50.30), (37.45, 50.30)], 0.72, "road"),
        ("sl.ru.rostov-mariupol", "Rostov → Mariupol Coastal", "ru",
            [(39.72, 47.24), (38.95, 47.10), (37.55, 47.10)], 0.78, "rail"),
        ("sl.ru.kerch-bridge", "Kerch Strait Bridge", "ru",
            [(36.62, 45.30), (36.40, 45.15), (35.95, 45.10)], 0.68, "road"),
        ("sl.ru.dzhankoi-zap", "Dzhankoi → Tokmak (Zaporizhzhia)", "ru",
            [(34.40, 45.71), (34.80, 46.50), (35.65, 47.10)], 0.66, "rail"),
        ("sl.ru.bryansk-front", "Bryansk → Kursk Lateral", "ru",
            [(34.37, 53.25), (35.00, 52.60), (36.18, 51.70)], 0.84, "rail"),
        ("sl.ru.voronezh-rostov", "Voronezh → Rostov Trunk", "ru",
            [(39.20, 51.65), (40.00, 49.90), (39.72, 47.24)], 0.88, "rail"),
        # BY corridors
        ("sl.by.minsk-mozyr", "Minsk → Mozyr Southern Spur", "ru",
            [(27.56, 53.90), (28.50, 52.80), (29.25, 52.05)], 0.72, "rail"),
        ("sl.by.brest-minsk", "Brest → Minsk", "ru",
            [(23.73, 52.10), (25.30, 53.20), (27.56, 53.90)], 0.78, "rail"),
    ]
    for sid, name, fac, path, health, mode in rows:
        b.add_supply_line(
            id=sid, name=name, faction_id=fac, path=path,
            health=health, mode=mode,
            available_actions=("interdict", "convoy", "harden"),
        )


def _add_isr(b: ScenarioBuilder) -> None:
    rows = [
        # UA
        ("isr.ua.bayraktar-1", "Bayraktar TB2 Patrol Sector A", "ua", 36.20, 49.95, 320, 90, 80, "uav", 0.7, "ua"),
        ("isr.ua.bayraktar-2", "Bayraktar TB2 Patrol Sector B", "ua", 35.14, 47.84, 320, 130, 80, "uav", 0.7, "ua"),
        ("isr.ua.gur-recce", "GUR Strategic Recce", "ua", 30.55, 50.45, 1500, 90, 60, "satellite", 0.6, "ua"),
        # NATO partner (rendered as UA-allied for v1)
        ("isr.nato.gh-ro", "RQ-4 Global Hawk (RO orbit)", "ua", 25.50, 44.50, 600, 60, 90, "uav", 0.85, None),
        ("isr.nato.rivet", "RC-135 Rivet Joint (BSEA orbit)", "ua", 28.50, 43.80, 500, 90, 100, "uav", 0.85, None),
        ("isr.nato.sat-1", "Allied SAR Constellation Pass", "ua", 33.00, 48.50, 800, 0, 360, "satellite", 0.8, None),
        # RU
        ("isr.ru.orlan-1", "Orlan-10 Patrol N", "ru", 36.55, 50.55, 120, 200, 70, "uav", 0.65, "ru"),
        ("isr.ru.orlan-2", "Orlan-10 Patrol S", "ru", 36.00, 47.30, 120, 290, 70, "uav", 0.65, "ru"),
        ("isr.ru.zala", "ZALA Lancet Recce", "ru", 38.00, 48.10, 80, 270, 60, "uav", 0.6, "ru"),
        ("isr.ru.a50", "A-50 AWACS (Belarus)", "ru", 27.51, 53.78, 400, 0, 360, "awacs", 0.78, "by"),
        ("isr.ru.kondor", "Kondor-FKA SAR Pass", "ru", 35.00, 47.50, 700, 0, 360, "satellite", 0.7, "ru"),
    ]
    for iid, name, fac, lon, lat, rng, hdg, beam, plat, conf, country in rows:
        b.add_isr(
            id=iid, name=name, faction_id=fac, lon=lon, lat=lat,
            range_km=rng, heading_deg=hdg, beam_deg=beam, platform=plat,
            confidence=conf, country_id=country,
            available_actions=("retask", "extend_orbit", "stand_down"),
        )


def _add_missile_ranges(b: ScenarioBuilder) -> None:
    rows = [
        # UA strike envelopes
        ("mr.ua.atacms-1", "ATACMS Battery (Donbas axis)", "ua", 35.05, 48.46, 300, "ATACMS", "ballistic"),
        ("mr.ua.storm-1", "Storm Shadow / SCALP (Su-24)", "ua", 27.24, 49.76, 250, "Storm Shadow", "cruise"),
        ("mr.ua.himars-1", "HIMARS Field Battery East", "ua", 36.10, 49.55, 80, "GMLRS", "mlrs"),
        ("mr.ua.himars-2", "HIMARS Field Battery South", "ua", 35.40, 47.55, 80, "GMLRS", "mlrs"),
        ("mr.ua.neptune", "Neptune Coastal Battery", "ua", 30.74, 46.50, 280, "R-360 Neptune", "cruise"),
        ("mr.ua.patriot-kyiv", "Patriot PAC-3 (Kyiv)", "ua", 30.55, 50.45, 160, "PAC-3", "sam"),
        ("mr.ua.iris-t", "IRIS-T SLM (Kharkiv)", "ua", 36.20, 49.95, 40, "IRIS-T", "sam"),
        # RU strike envelopes
        ("mr.ru.iskander-bel", "Iskander-M (Belgorod)", "ru", 36.55, 50.55, 480, "Iskander-M", "ballistic"),
        ("mr.ru.iskander-vor", "Iskander-M (Voronezh)", "ru", 39.20, 51.65, 480, "Iskander-M", "ballistic"),
        ("mr.ru.iskander-cri", "Iskander-M (Dzhankoi)", "ru", 34.40, 45.71, 480, "Iskander-M", "ballistic"),
        ("mr.ru.kalibr-bsf", "Kalibr (Black Sea Fleet)", "ru", 37.10, 44.10, 1500, "3M-14 Kalibr", "cruise"),
        ("mr.ru.kalibr-cas", "Kalibr (Caspian Flotilla)", "ru", 47.65, 42.88, 1500, "3M-14 Kalibr", "cruise"),
        ("mr.ru.kinzhal", "Kinzhal (MiG-31K, Engels)", "ru", 46.21, 51.48, 2000, "Kh-47M2 Kinzhal", "ballistic"),
        ("mr.ru.s400-cri", "S-400 (Crimea)", "ru", 33.95, 44.90, 400, "S-400 / 40N6", "sam"),
        ("mr.ru.s400-bel", "S-400 (Belgorod)", "ru", 36.55, 50.55, 400, "S-400 / 40N6", "sam"),
        ("mr.ru.s400-by", "S-400 (Belarus)", "ru", 28.64, 53.30, 400, "S-400 / 40N6", "sam"),
    ]
    for mid, name, fac, lon, lat, rng, weapon, cat in rows:
        b.add_missile_range(
            id=mid, name=name, faction_id=fac, lon=lon, lat=lat,
            range_km=float(rng), weapon=weapon, category=cat,
            available_actions=("strike", "displace", "stand_down"),
        )


def _add_aors(b: ScenarioBuilder) -> None:
    # Coarse polygons; the FE softens them.
    aors = [
        ("aor.ua.skhid", "OK 'Skhid' AOR", "ua",
            [(36.0, 49.7), (40.5, 49.5), (40.5, 47.5), (36.5, 47.0), (36.0, 49.7)], None),
        ("aor.ua.pivden", "OK 'Pivden' AOR", "ua",
            [(30.5, 47.5), (36.5, 47.5), (36.5, 45.8), (30.5, 45.8), (30.5, 47.5)], None),
        ("aor.ua.pivnich", "OK 'Pivnich' AOR", "ua",
            [(28.5, 52.4), (35.0, 52.4), (35.0, 50.0), (28.5, 50.0), (28.5, 52.4)], None),
        ("aor.ua.zakhid", "OK 'Zakhid' AOR", "ua",
            [(22.0, 51.0), (28.0, 51.0), (28.0, 47.5), (22.0, 47.5), (22.0, 51.0)], None),
        ("aor.ru.gof-north", "GoF North AOR", "ru",
            [(34.0, 52.5), (40.0, 52.5), (40.0, 49.5), (34.0, 49.5), (34.0, 52.5)], None),
        ("aor.ru.gof-centre", "GoF Centre AOR", "ru",
            [(36.0, 50.0), (40.0, 50.0), (40.0, 48.5), (36.0, 48.5), (36.0, 50.0)], None),
        ("aor.ru.gof-south", "GoF South AOR", "ru",
            [(36.0, 48.5), (40.5, 48.5), (40.5, 46.7), (36.0, 46.7), (36.0, 48.5)], None),
        ("aor.ru.gof-tavria", "GoF Dnipro / Tavria AOR", "ru",
            [(32.5, 47.6), (36.5, 47.6), (36.5, 46.0), (32.5, 46.0), (32.5, 47.6)], None),
    ]
    for aid, name, fac, ring, formation in aors:
        b.add_aor(
            id=aid, name=name, faction_id=fac, ring=ring, formation_id=formation,
            available_actions=("re-task", "split", "merge"),
        )


def _add_frontline(b: ScenarioBuilder) -> None:
    # Approximate 2025/26 line of contact: NE Kharkiv → Lyman → Bakhmut →
    # Avdiivka → Vuhledar → Velyka Novosilka → Robotyne → Tokmak → Dnipro estuary.
    path = [
        (37.45, 50.30),  # Vovchansk salient
        (37.85, 49.55),  # Kupiansk
        (38.05, 49.05),  # Lyman
        (38.05, 48.59),  # Bakhmut
        (37.92, 48.42),  # Chasiv Yar / Toretsk
        (37.74, 48.13),  # Avdiivka
        (37.30, 47.80),  # Vuhledar
        (36.85, 47.85),  # Velyka Novosilka
        (35.85, 47.43),  # Robotyne
        (35.42, 47.27),  # Tokmak ~ N edge
        (33.20, 46.50),  # Kherson east bank
        (31.85, 46.20),  # Kinburn / Dnipro mouth
    ]
    b.add_frontline(
        id="front.main",
        name="Line of Contact",
        path=path,
        buffer_km=8.0,
        updated_at=datetime(2026, 4, 25, 6, 0, tzinfo=timezone.utc),
        notes="Open-source synthesis. Non-authoritative. Buffered 8 km either side.",
        available_actions=("counter-attack", "consolidate", "withdraw"),
    )
    # silence unused import lint
    _ = Coordinate


# ---------------------------------------------------------------------------
# Political layer: pressure, credibility, leader signals (Phase 9)
# ---------------------------------------------------------------------------


def _add_political(b: ScenarioBuilder) -> None:
    """Seed the political layer.

    Numbers are illustrative scenario assumptions, not predictions. They give
    the engine and HUD live values to react to. The sim hooks decay/update
    these values turn-on-turn; the seed is just the starting position.
    """
    b.with_current_turn(0)
    b.with_global_deadline(12)  # 12-turn campaign window

    # Per-faction pressure + team goals.
    # Team-goal framing follows the NATO Wargaming Handbook (HQ SACT, 2023)
    # Fig. 7: time-bound, single-sentence player goals tied to a turn target.
    # `intensity` is the friction the team faces against that goal; the sim
    # hook recomputes it each turn from regions + deadline ramp.
    b.add_faction_pressure(
        faction_id="ru",
        intensity=0.62,
        deadline_turn=8,
        team_goal="stabilise mobilisation by",
        drivers=(
            "mobilisation backlog",
            "energy revenue volatility",
            "elite cohesion strain",
        ),
    )
    b.add_faction_pressure(
        faction_id="ua",
        intensity=0.74,
        deadline_turn=6,
        team_goal="secure aid tranche by",
        drivers=(
            "Western aid window narrowing",
            "manpower replenishment shortfall",
            "winter energy infrastructure exposure",
        ),
    )
    b.add_faction_pressure(
        faction_id="nato",
        intensity=0.35,
        deadline_turn=10,
        team_goal="hold alliance unity through",
        drivers=("alliance unity messaging", "domestic election cycles"),
    )

    # Region-level pressure on the most active sectors.
    b.add_region_pressure(
        region_id="terr.donbas-occ",
        intensity=0.78,
        drivers=("intense ground combat", "civilian displacement"),
    )
    b.add_region_pressure(
        region_id="terr.crimea-occ",
        intensity=0.55,
        drivers=("naval pressure on Sevastopol", "Kerch bridge interdiction risk"),
    )
    b.add_region_pressure(
        region_id="obl.63",  # Kharkiv
        intensity=0.66,
        drivers=("border salient activity", "civilian outflow"),
    )
    b.add_region_pressure(
        region_id="obl.23",  # Zaporizhzhia
        intensity=0.60,
        drivers=("Robotyne-Tokmak axis", "ZNPP perimeter risk"),
    )
    b.add_region_pressure(
        region_id="obl.65",  # Kherson
        intensity=0.52,
        drivers=("east-bank artillery exchanges",),
    )

    # Bilateral credibility tracks. Two-track per ordered pair across the
    # primary belligerents and NATO. Initial values reflect baseline trust
    # given a long-running conflict.
    tracks: tuple[tuple[str, str, float, float], ...] = (
        ("ru", "ua", -0.55, -0.40),
        ("ua", "ru", -0.60, -0.45),
        ("ru", "nato", -0.50, -0.30),
        ("nato", "ru", -0.45, -0.25),
        ("ua", "nato", 0.40, 0.30),
        ("nato", "ua", 0.50, 0.35),
    )
    for src, dst, immediate, resolve in tracks:
        b.add_credibility(
            from_faction_id=src,
            to_faction_id=dst,
            immediate=immediate,
            resolve=resolve,
            last_updated_turn=0,
        )

    # Stub leader signals. Five recent statements covering ultimatums,
    # commitments, threats and reassurance. Severity is signed (-1..+1)
    # aligned to Goldstein/10. The GDELT adapter (see
    # `intel/leader_statements.py`) emits records of this same shape.
    base_ts = datetime(2026, 4, 24, 9, 0, tzinfo=timezone.utc)
    signals = (
        dict(
            id="sig.stub.001",
            speaker_faction_id="ru",
            type=LeaderSignalType.ULTIMATUM,
            severity=-0.85,
            text=(
                "Demands negotiated halt within 30 days or further "
                "mobilisation will be authorised."
            ),
            target_faction_id="ua",
            cameo_code="172",
            goldstein=-8.5,
        ),
        dict(
            id="sig.stub.002",
            speaker_faction_id="ua",
            type=LeaderSignalType.COMMITMENT,
            severity=0.55,
            text="Public commitment to defend Kharkiv salient at all costs.",
            target_faction_id=None,
            region_id="obl.63",
            cameo_code="057",
            goldstein=5.5,
        ),
        dict(
            id="sig.stub.003",
            speaker_faction_id="nato",
            type=LeaderSignalType.REASSURANCE,
            severity=0.65,
            text="Reaffirms multi-year materiel support for Ukraine.",
            target_faction_id="ua",
            cameo_code="050",
            goldstein=6.5,
        ),
        dict(
            id="sig.stub.004",
            speaker_faction_id="ru",
            type=LeaderSignalType.THREAT,
            severity=-0.70,
            text="Warns of asymmetric response if NATO strike packages cross red line.",
            target_faction_id="nato",
            cameo_code="138",
            goldstein=-7.0,
        ),
        dict(
            id="sig.stub.005",
            speaker_faction_id="ua",
            type=LeaderSignalType.DEMAND,
            severity=-0.30,
            text="Demands accelerated air defence deliveries from allies.",
            target_faction_id="nato",
            cameo_code="112",
            goldstein=-3.0,
        ),
    )
    for i, s in enumerate(signals):
        b.add_leader_signal(
            timestamp=base_ts.replace(hour=9 + i),
            source="stub",
            turn=0,
            **s,
        )
