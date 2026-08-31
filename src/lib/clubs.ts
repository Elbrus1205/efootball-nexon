import { promises as fs } from "fs";
import path from "path";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { TOP_FIVE_LEAGUES } from "@/lib/club-catalog";

export type ClubOption = {
  slug: string;
  name: string;
  imagePath: string;
  leagueSlug?: string | null;
  leagueName?: string | null;
  isRegistrationEnabled?: boolean;
  isInGameEnabled?: boolean;
};

export type LeagueOption = {
  slug: string;
  name: string;
  badgePath: string;
  isEnabled?: boolean;
};

type ClubDefinition = {
  fileName: string;
  name: string;
};

const CLUBS_DIR = path.join(process.cwd(), "public", "club-badges");
const CLUB_THUMBS_DIR = path.join(CLUBS_DIR, "thumbs");

const TOP_FIVE_CLUB_LEAGUES: Record<string, string> = {
  arsenal: "premier-league", "aston-villa": "premier-league", bournemouth: "premier-league", brentford: "premier-league",
  "brighton-hove-albion-big-768x773": "premier-league", burnley: "premier-league", chelsea: "premier-league", "crystal-palace-big-2022": "premier-league",
  everton: "premier-league", fulham: "premier-league", "leeds-united-big (1)": "premier-league", "leicester-city-big-768x768": "premier-league",
  liverpool: "premier-league", "manchester-city": "premier-league", "manchester-united": "premier-league", "newcastle-united-big-768x774": "premier-league",
  "nottingham-forest-big": "premier-league", "southampton-big": "premier-league", "sunderland-big-768x640 (1)": "premier-league", "tottenham-hotspur": "premier-league",
  "west-ham-united": "premier-league", "wolverhampton-wanderers-big-768x666": "premier-league",
  "bournemouth-big": "premier-league", "brentford-big-768x768": "premier-league", "everton-big-768x786": "premier-league",
  barcelona: "la-liga", "athletic-club-big-2013 (1)": "la-liga", "atletico-madrid": "la-liga", "real-betis": "la-liga", "real-madrid": "la-liga", "real-sociedad-big": "la-liga", "sevilla-big": "la-liga", valencia: "la-liga", "villarreal-big": "la-liga", "girona-big-768x768": "la-liga", "celta-vigo-big": "la-liga", "espanyol-big": "la-liga",
  "getafe-big": "la-liga", "osasuna-big": "la-liga", "huesca-big": "la-liga", "rayo-vallecano-big-768x682": "la-liga", "mallorca-big": "la-liga", "real-valladolid-big-2022": "la-liga", "Deportivo-La-Coruna (1)": "la-liga", "Real_Zaragoza_logo.svg": "la-liga",
  "psg-big-768x768": "ligue-1", lyon: "ligue-1", "lyon-big-2022": "ligue-1", marseille: "ligue-1", monaco: "ligue-1", lille: "ligue-1", nice: "ligue-1", rennes: "ligue-1", lens: "ligue-1", "bordeaux-big": "ligue-1", "saint-etienne-big-2022": "ligue-1", nantes: "ligue-1", "montpellier-big-768x768": "ligue-1", strasbourg: "ligue-1",
  "lille-big-768x731": "ligue-1", "nice-big": "ligue-1", "rennes-big": "ligue-1", "lens-big": "ligue-1", "nantes-big-2020": "ligue-1", "strasbourg-big-768x768": "ligue-1", "auxerre-big": "ligue-1", "brest-big": "ligue-1", "clermont-big": "ligue-1", "lorient-big": "ligue-1", "metz-big-2021": "ligue-1", "reims-big-2020": "ligue-1", "toulouse-big-768x768": "ligue-1",
  "bayern-munich-big-768x768": "bundesliga", "borussia-dortmund": "bundesliga", "bayer-04-leverkusen": "bundesliga", "rb-leipzig-big-587x300": "bundesliga", "eintracht-frankfurt-big-768x768": "bundesliga", "borussia-monchengladbach-big": "bundesliga", stuttgart: "bundesliga", wolfsburg: "bundesliga", "werder-bremen-big": "bundesliga", "hamburger-big-405x300": "bundesliga", "schalke-04-big-768x768": "bundesliga", "koln-big": "bundesliga", "hertha-big-768x715": "bundesliga",
  "stuttgart-big": "bundesliga", "wolfsburg-big-768x768": "bundesliga", "augsburg-big": "bundesliga", "freiburg-big": "bundesliga", "hoffenheim-big": "bundesliga", "mainz-05-big-768x715": "bundesliga", "union-berlin-big-768x280": "bundesliga", "hannover-96-big-768x677": "bundesliga", "1._FC_NГјrnberg_logo.svg": "bundesliga",
  atalanta: "serie-a", bologna: "serie-a", "como-1907-big-768x794": "serie-a", fiorentina: "serie-a", "inter-milan": "serie-a", juventus: "serie-a", lazio: "serie-a", milan: "serie-a", napoli: "serie-a", "roma-big (1)": "serie-a", torino: "serie-a", "genoa-big-2022": "serie-a", sampdoria: "serie-a", parma: "serie-a", "udinese-big-768x765": "serie-a",
  "bologna-big": "serie-a", "fiorentina-big-2022-768x768": "serie-a", "lazio-big-443x300": "serie-a", "napoli-big-2024-768x768": "serie-a", "torino-big": "serie-a", "sampdoria-big": "serie-a", "parma-big": "serie-a", "sassuolo-big": "serie-a", "cagliari-big": "serie-a", "lecce-big-2023": "serie-a", "empoli-big-2021": "serie-a", "Hellas_verona_logo_3": "serie-a",
};

export function getBundledClubLeagueSlug(slug: string) {
  return TOP_FIVE_CLUB_LEAGUES[slug] ?? null;
}

const CLUBS: ClubDefinition[] = [
  { fileName: "ajax-amsterdam-big-768x773.png", name: "РђСЏРєСЃ" },
  { fileName: "al-hilal-saudi-big.png", name: "РђР»СЊ-РҐРёР»СЏР»СЊ" },
  { fileName: "al-nassr-big-2025-768x768.png", name: "РђР»СЊ-РќР°СЃСЂ" },
  { fileName: "arsenal.png", name: "РђСЂСЃРµРЅР°Р»" },
  { fileName: "aston-villa.png", name: "РђСЃС‚РѕРЅ Р’РёР»Р»Р°" },
  { fileName: "atalanta.png", name: "РђС‚Р°Р»Р°РЅС‚Р°" },
  { fileName: "athletic-club-big-2013 (1).png", name: "РђС‚Р»РµС‚РёРє Р‘РёР»СЊР±Р°Рѕ" },
  { fileName: "atletico-madrid.png", name: "РђС‚Р»РµС‚РёРєРѕ РњР°РґСЂРёРґ" },
  { fileName: "barcelona.png", name: "Р‘Р°СЂСЃРµР»РѕРЅР°" },
  { fileName: "bayer-04-leverkusen.png", name: "Р‘Р°Р№РµСЂ 04" },
  { fileName: "bayern-munich-big-768x768.png", name: "Р‘Р°РІР°СЂРёСЏ" },
  { fileName: "benfica.png", name: "Р‘РµРЅС„РёРєР°" },
  { fileName: "bologna-big.png", name: "Р‘РѕР»РѕРЅСЊСЏ" },
  { fileName: "borussia-dortmund.png", name: "Р‘РѕСЂСѓСЃСЃРёСЏ Р”РѕСЂС‚РјСѓРЅРґ" },
  { fileName: "bournemouth-big.png", name: "Р‘РѕСЂРЅРјСѓС‚" },
  { fileName: "brentford-big-768x768.png", name: "Р‘СЂРµРЅС‚С„РѕСЂРґ" },
  { fileName: "brighton-hove-albion-big-768x773.png", name: "Р‘СЂР°Р№С‚РѕРЅ" },
  { fileName: "burnley-big-2023 (1).png", name: "Р‘РµСЂРЅР»Рё" },
  { fileName: "celtic-big-768x768.png", name: "РЎРµР»С‚РёРє" },
  { fileName: "chelsea.png", name: "Р§РµР»СЃРё" },
  { fileName: "como-1907-big-768x794.png", name: "РљРѕРјРѕ" },
  { fileName: "crystal-palace-big-2022.png", name: "РљСЂРёСЃС‚Р°Р» РџСЌР»Р°СЃ" },
  { fileName: "eintracht-frankfurt-big-768x768.png", name: "РђР№РЅС‚СЂР°С…С‚ Р¤СЂР°РЅРєС„СѓСЂС‚" },
  { fileName: "everton-big-768x786.png", name: "Р­РІРµСЂС‚РѕРЅ" },
  { fileName: "fenerbahce.png", name: "Р¤РµРЅРµСЂР±Р°С…С‡Рµ" },
  { fileName: "fiorentina-big-2022-768x768.png", name: "Р¤РёРѕСЂРµРЅС‚РёРЅР°" },
  { fileName: "flamengo-big.png", name: "Р¤Р»Р°РјРµРЅРіРѕ" },
  { fileName: "fulham-big.png", name: "Р¤СѓР»С…СЌРј" },
  { fileName: "galatasaray-big.png", name: "Р“Р°Р»Р°С‚Р°СЃР°СЂР°Р№" },
  { fileName: "girona-big-768x768.png", name: "Р–РёСЂРѕРЅР°" },
  { fileName: "inter-milan.png", name: "РРЅС‚РµСЂ" },
  { fileName: "juventus.png", name: "Р®РІРµРЅС‚СѓСЃ" },
  { fileName: "lazio-big-443x300.png", name: "Р›Р°С†РёРѕ" },
  { fileName: "leeds-united-big (1).png", name: "Р›РёРґСЃ Р®РЅР°Р№С‚РµРґ" },
  { fileName: "leicester-city-big-768x768.png", name: "Р›РµСЃС‚РµСЂ" },
  { fileName: "lille-big-768x731.png", name: "Р›РёР»Р»СЊ" },
  { fileName: "liverpool.png", name: "Р›РёРІРµСЂРїСѓР»СЊ" },
  { fileName: "lyon-big-2022.png", name: "Р›РёРѕРЅ" },
  { fileName: "manchester-city.png", name: "РњР°РЅС‡РµСЃС‚РµСЂ РЎРёС‚Рё" },
  { fileName: "manchester-united.png", name: "РњР°РЅС‡РµСЃС‚РµСЂ Р®РЅР°Р№С‚РµРґ" },
  { fileName: "marseille.png", name: "РњР°СЂСЃРµР»СЊ" },
  { fileName: "milan.png", name: "РњРёР»Р°РЅ" },
  { fileName: "monaco.png", name: "РњРѕРЅР°РєРѕ" },
  { fileName: "napoli-big-2024-768x768.png", name: "РќР°РїРѕР»Рё" },
  { fileName: "newcastle-united-big-768x774.png", name: "РќСЊСЋРєР°СЃР» Р®РЅР°Р№С‚РµРґ" },
  { fileName: "nottingham-forest-big.png", name: "РќРѕС‚С‚РёРЅРіРµРј Р¤РѕСЂРµСЃС‚" },
  { fileName: "porto.png", name: "РџРѕСЂС‚Сѓ" },
  { fileName: "psg-big-768x768.png", name: "РџРЎР–" },
  { fileName: "psv-eindhoven-big-768x630.png", name: "РџРЎР’" },
  { fileName: "rangers-big-2020-768x768.png", name: "Р РµР№РЅРґР¶РµСЂСЃ" },
  { fileName: "rb-leipzig-big-587x300.png", name: "Р Р‘ Р›РµР№РїС†РёРі" },
  { fileName: "real-betis.png", name: "Р РµР°Р» Р‘РµС‚РёСЃ" },
  { fileName: "real-madrid.png", name: "Р РµР°Р» РњР°РґСЂРёРґ" },
  { fileName: "real-sociedad-big.png", name: "Р РµР°Р» РЎРѕСЃСЊРµРґР°Рґ" },
  { fileName: "river-plate-big.png", name: "Р РёРІРµСЂ РџР»РµР№С‚" },
  { fileName: "roma-big (1).png", name: "Р РѕРјР°" },
  { fileName: "sevilla-big.png", name: "РЎРµРІРёР»СЊСЏ" },
  { fileName: "sporting.png", name: "РЎРїРѕСЂС‚РёРЅРі" },
  { fileName: "strasbourg-big-768x768.png", name: "РЎС‚СЂР°СЃР±СѓСЂРі" },
  { fileName: "sunderland-big-768x640 (1).png", name: "РЎР°РЅРґРµСЂР»РµРЅРґ" },
  { fileName: "tottenham-hotspur.png", name: "РўРѕС‚С‚РµРЅС…СЌРј" },
  { fileName: "valencia-big.png", name: "Р’Р°Р»РµРЅСЃРёСЏ" },
  { fileName: "valencia.png", name: "Валенсия" },
  { fileName: "villarreal-big.png", name: "Р’РёР»СЊСЏСЂСЂРµР°Р»" },
  { fileName: "west-ham-united.png", name: "Р’РµСЃС‚ РҐСЌРј" },
  { fileName: "wolverhampton-wanderers-big-768x666.png", name: "Р’СѓР»РІРµСЂС…СЌРјРїС‚РѕРЅ" },
  { fileName: "southampton-big.png", name: "РЎР°СѓС‚РіРµРјРїС‚РѕРЅ" },
  { fileName: "blackburn-rovers-big-768x795.png", name: "Р‘Р»СЌРєР±РµСЂРЅ" },
  { fileName: "norwich-city-big-2022.png", name: "РќРѕСЂРІРёС‡" },
  { fileName: "celta-vigo-big.png", name: "РЎРµР»СЊС‚Р°" },
  { fileName: "Deportivo-La-Coruna.png", name: "Р”РµРїРѕСЂС‚РёРІРѕ" },
  { fileName: "espanyol-big.png", name: "Р­СЃРїР°РЅСЊРѕР»" },
  { fileName: "Real_Zaragoza_logo.svg.png", name: "Р РµР°Р» РЎР°СЂР°РіРѕСЃР°" },
  { fileName: "torino-big.png", name: "РўРѕСЂРёРЅРѕ" },
  { fileName: "genoa-big-2022.png", name: "Р”Р¶РµРЅРѕР°" },
  { fileName: "sampdoria-big.png", name: "РЎР°РјРїРґРѕСЂРёСЏ" },
  { fileName: "parma-big.png", name: "РџР°СЂРјР°" },
  { fileName: "udinese-big-768x765.png", name: "РЈРґРёРЅРµР·Рµ" },
  { fileName: "borussia-monchengladbach-big.png", name: "Р‘РѕСЂСѓСЃСЃРёСЏ Рњ" },
  { fileName: "stuttgart-big.png", name: "РЁС‚СѓС‚РіР°СЂС‚" },
  { fileName: "wolfsburg-big-768x768.png", name: "Р’РѕР»СЊС„СЃР±СѓСЂРі" },
  { fileName: "werder-bremen-big.png", name: "Р’РµСЂРґРµСЂ" },
  { fileName: "hamburger-big-405x300.png", name: "Р“Р°РјР±СѓСЂРі" },
  { fileName: "schalke-04-big-768x768.png", name: "РЁР°Р»СЊРєРµ" },
  { fileName: "koln-big.png", name: "РљС‘Р»СЊРЅ" },
  { fileName: "hertha-big-768x715.png", name: "Р“РµСЂС‚Р°" },
  { fileName: "nice-big.png", name: "РќРёС†С†Р°" },
  { fileName: "rennes-big.png", name: "Р РµРЅРЅ" },
  { fileName: "lens-big.png", name: "Р›Р°РЅСЃ" },
  { fileName: "bordeaux-big.png", name: "Р‘РѕСЂРґРѕ" },
  { fileName: "saint-etienne-big-2022.png", name: "РЎРµРЅС‚-Р­С‚СЊРµРЅ" },
  { fileName: "nantes-big-2020.png", name: "РќР°РЅС‚" },
  { fileName: "montpellier-big-768x768.png", name: "РњРѕРЅРїРµР»СЊРµ" },
  { fileName: "feyenoord-big-768x768.png", name: "Р¤РµР№РµРЅРѕРѕСЂРґ" },
  { fileName: "az-alkmaar-big-612x300.png", name: "РђР—" },
  { fileName: "twente-big.png", name: "РўРІРµРЅС‚Рµ" },
  { fileName: "S.C._Braga_logo.svg.png", name: "Р‘СЂР°РіР°" },
  { fileName: "besiktas-big.png", name: "Р‘РµС€РёРєС‚Р°С€" },
  { fileName: "Trabzonspor_(logo).png", name: "РўСЂР°Р±Р·РѕРЅСЃРїРѕСЂ" },
  { fileName: "zenit-big-2023-400x263.png", name: "Р—РµРЅРёС‚" },
  { fileName: "spartak-moskva-big-2022-new-400x281.png", name: "РЎРїР°СЂС‚Р°Рє" },
  { fileName: "cska-moskva-big.png", name: "Р¦РЎРљРђ" },
  { fileName: "dynamo-kyiv-big.png", name: "Р”РёРЅР°РјРѕ Рљ" },
  { fileName: "shakhtar-donetsk-big.png", name: "РЁР°С…С‚С‘СЂ" },
  { fileName: "olympiacos-big.png", name: "РћР»РёРјРїРёР°РєРѕСЃ" },
  { fileName: "panathinaikos-big-768x768.png", name: "РџР°РЅР°С‚РёРЅР°РёРєРѕСЃ" },
  { fileName: "aek-athens-big.png", name: "РђР•Рљ" },
  { fileName: "brugge-big.png", name: "Р‘СЂСЋРіРіРµ" },
  { fileName: "anderlecht-big-768x757.png", name: "РђРЅРґРµСЂР»РµС…С‚" },
  { fileName: "red-bull-salzburg-big-768x780 (1).png", name: "Р—Р°Р»СЊС†Р±СѓСЂРі" },
  { fileName: "basel-big.png", name: "Р‘Р°Р·РµР»СЊ" },
  { fileName: "palmeiras-big-768x768.png", name: "РџР°Р»РјРµР№СЂР°СЃ" },
  { fileName: "corinthians-big.png", name: "РљРѕСЂРёРЅС‚РёР°РЅСЃ" },
  { fileName: "santos-big.png", name: "РЎР°РЅС‚РѕСЃ" },
  { fileName: "sao-paulo-big-768x765.png", name: "РЎР°РЅ-РџР°СѓР»Сѓ" },
  { fileName: "gremio-big.png", name: "Р“СЂРµРјРёРѕ" },
  { fileName: "boca-juniors-big.png", name: "Р‘РѕРєР° РҐСѓРЅРёРѕСЂСЃ" },
  { fileName: "independiente-big.png", name: "РРЅРґРµРїРµРЅРґСЊРµРЅС‚Рµ" },
  { fileName: "Escudo_de_Racing_Club_(2014).svg.png", name: "Р Р°СЃРёРЅРі" },
  { fileName: "America_S.A._de_C.V.png", name: "РђРјРµСЂРёРєР°" },
  { fileName: "crvena-zvezda-big.png", name: "Р¦СЂРІРµРЅР° Р—РІРµР·РґР°" },
  { fileName: "slavia-praha-big-2022.png", name: "РЎР»Р°РІРёСЏ" },
  { fileName: "sparta-prague-big-2021.png", name: "РЎРїР°СЂС‚Р°" },
  { fileName: "dinamo-zagreb-big-768x768.png", name: "Р—Р°РіСЂРµР±" },
  { fileName: "legia-warsaw-big.png", name: "Р›РµРіРёСЏ" },
  { fileName: "apoel-big.png", name: "РђРџРћР­Р›" },
  { fileName: "kobenhavn-big-768x768.png", name: "РљРѕРїРµРЅРіР°РіРµРЅ" },
  { fileName: "malmo-big.png", name: "РњР°Р»СЊРјС‘" },
  { fileName: "ludogorets-big.png", name: "Р›СѓРґРѕРіРѕСЂРµС†" },
  // Recently uploaded badges for the expanded top-five leagues
  { fileName: "everton-big-768x786.png", name: "Р­РІРµСЂС‚РѕРЅ" },
  { fileName: "getafe-big.png", name: "РҐРµС‚Р°С„Рµ" },
  { fileName: "osasuna-big.png", name: "РћСЃР°СЃСѓРЅР°" },
  { fileName: "rayo-vallecano-big-768x682.png", name: "Р Р°Р№Рѕ Р’Р°Р»СЊРµРєР°РЅРѕ" },
  { fileName: "mallorca-big.png", name: "РњР°Р»СЊРѕСЂРєР°" },
  { fileName: "real-valladolid-big-2022.png", name: "Р РµР°Р» Р’Р°Р»СЊСЏРґРѕР»РёРґ" },
  { fileName: "Deportivo-La-Coruna (1).png", name: "Р”РµРїРѕСЂС‚РёРІРѕ Р›Р°-РљРѕСЂСѓРЅСЊСЏ" },
  { fileName: "Real_Zaragoza_logo.svg.webp", name: "Р РµР°Р» РЎР°СЂР°РіРѕСЃР°" },
  { fileName: "valencia-big (1).png", name: "Р’Р°Р»РµРЅСЃРёСЏ" },
  { fileName: "auxerre-big.png", name: "РћСЃРµСЂ" },
  { fileName: "brest-big.png", name: "Р‘СЂРµСЃС‚" },
  { fileName: "clermont-big.png", name: "РљР»РµСЂРјРѕРЅ" },
  { fileName: "lorient-big.png", name: "Р›РѕСЂСЊСЏРЅ" },
  { fileName: "metz-big-2021.png", name: "РњРµС†" },
  { fileName: "reims-big-2020.png", name: "Р РµР№РјСЃ" },
  { fileName: "toulouse-big-768x768.png", name: "РўСѓР»СѓР·Р°" },
  { fileName: "augsburg-big.png", name: "РђСѓРіСЃР±СѓСЂРі" },
  { fileName: "freiburg-big.png", name: "Р¤СЂР°Р№Р±СѓСЂРі" },
  { fileName: "hoffenheim-big.png", name: "РҐРѕС„С„РµРЅС…Р°Р№Рј" },
  { fileName: "mainz-05-big-768x715.png", name: "РњР°Р№РЅС† 05" },
  { fileName: "union-berlin-big-768x280.png", name: "РЈРЅРёРѕРЅ Р‘РµСЂР»РёРЅ" },
  { fileName: "hannover-96-big-768x677.png", name: "Р“Р°РЅРЅРѕРІРµСЂ 96" },
  { fileName: "1._FC_NГјrnberg_logo.svg.webp", name: "РќСЋСЂРЅР±РµСЂРі" },
  { fileName: "sassuolo-big.png", name: "РЎР°СЃСЃСѓРѕР»Рѕ" },
  { fileName: "cagliari-big.png", name: "РљР°Р»СЊСЏСЂРё" },
  { fileName: "lecce-big-2023.png", name: "Р›РµС‡С‡Рµ" },
  { fileName: "empoli-big-2021.png", name: "Р­РјРїРѕР»Рё" },
  { fileName: "Hellas_verona_logo_3.png", name: "Р’РµСЂРѕРЅР°" },];

function sortClubs(clubs: ClubOption[]) {
  return clubs.sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export async function getAvailableClubs() {
  return getCachedAvailableClubs();
}

export async function getAvailableLeagues(): Promise<LeagueOption[]> {
  try {
    const leagues = await db.league.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, badgePath: true, isEnabled: true } });
    if (leagues.length) return leagues;
  } catch {
    // Migration may not have been deployed yet; use the bundled top-five catalogue.
  }
  return TOP_FIVE_LEAGUES.map((league) => ({ ...league, isEnabled: true }));
}

export async function getTournamentClubs(tournamentId: string) {
  try {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { clubSelectionByLeague: true, clubSelectionInGameOnly: true, selectedLeagues: { select: { league: { select: { id: true } } } } },
    });
    if (tournament) {
      const leagueIds = tournament.selectedLeagues.map((item) => item.league.id);
      if (tournament.clubSelectionByLeague && leagueIds.length === 0) return [];
      const clubs = await db.club.findMany({
        where: {
          isRegistrationEnabled: true,
          ...(tournament.clubSelectionInGameOnly ? { isInGameEnabled: true } : {}),
          ...(tournament.clubSelectionByLeague && leagueIds.length ? { leagueId: { in: leagueIds } } : {}),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { slug: true, name: true, imagePath: true, isRegistrationEnabled: true, isInGameEnabled: true, league: { select: { slug: true, name: true } } },
      });
      if (clubs.length) return clubs.map((club) => ({ ...club, leagueSlug: club.league?.slug ?? null, leagueName: club.league?.name ?? null }));
    }
  } catch {
    // Fall through to the static catalogue while the database is being migrated.
  }
  return getAvailableClubs();
}

export async function ensureManagedClubCatalog() {
  const bundledClubs = await getAvailableClubs();
  try {
    const leagueIds = new Map<string, string>();
    for (const [index, league] of TOP_FIVE_LEAGUES.entries()) {
      const saved = await db.league.upsert({
        where: { slug: league.slug },
        create: { slug: league.slug, name: league.name, badgePath: league.badgePath, sortOrder: index },
        update: { name: league.name, badgePath: league.badgePath, sortOrder: index },
        select: { id: true },
      });
      leagueIds.set(league.slug, saved.id);
    }
    for (const [index, club] of bundledClubs.entries()) {
      await db.club.upsert({
        where: { slug: club.slug },
        create: { slug: club.slug, name: club.name, imagePath: club.imagePath, leagueId: club.leagueSlug ? leagueIds.get(club.leagueSlug) : null, sortOrder: index },
        update: { name: club.name, imagePath: club.imagePath, leagueId: club.leagueSlug ? leagueIds.get(club.leagueSlug) : null, sortOrder: index },
      });
    }
    return true;
  } catch {
    return false;
  }
}

const getCachedAvailableClubs = unstable_cache(
  async () => {
    try {
      const entries = await fs.readdir(CLUBS_DIR, { withFileTypes: true });
      const thumbEntries = await fs.readdir(CLUB_THUMBS_DIR, { withFileTypes: true }).catch(() => []);
      const existingFileNames = new Set(
        entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
      );
      const existingThumbFileNames = new Set(
        thumbEntries.filter((entry) => entry.isFile()).map((entry) => entry.name),
      );

      const clubs = CLUBS.filter((club) => existingFileNames.has(club.fileName)).map((club) => {
        const slug = path.basename(club.fileName, path.extname(club.fileName));
        const thumbFileName = `${slug}.webp`;

        const leagueSlug = getBundledClubLeagueSlug(slug);
        const league = TOP_FIVE_LEAGUES.find((item) => item.slug === leagueSlug);
        return {
          slug,
          name: club.name,
          imagePath: existingThumbFileNames.has(thumbFileName) ? `/club-badges/thumbs/${thumbFileName}` : `/club-badges/${club.fileName}`,
          leagueSlug,
          leagueName: league?.name ?? null,
          isRegistrationEnabled: true,
          isInGameEnabled: true,
        };
      });

      return sortClubs(clubs);
    } catch {
      return [];
    }
  },
  ["available-clubs"],
  { revalidate: 3600 },
);
