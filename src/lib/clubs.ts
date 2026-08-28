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
  "psg-big-768x768": "ligue-1", lyon: "ligue-1", marseille: "ligue-1", monaco: "ligue-1", lille: "ligue-1", nice: "ligue-1", rennes: "ligue-1", lens: "ligue-1", "bordeaux-big": "ligue-1", "saint-etienne-big-2022": "ligue-1", nantes: "ligue-1", "montpellier-big-768x768": "ligue-1", strasbourg: "ligue-1",
  "lille-big-768x731": "ligue-1", "nice-big": "ligue-1", "rennes-big": "ligue-1", "lens-big": "ligue-1", "nantes-big-2020": "ligue-1", "strasbourg-big-768x768": "ligue-1", "auxerre-big": "ligue-1", "brest-big": "ligue-1", "clermont-big": "ligue-1", "lorient-big": "ligue-1", "metz-big-2021": "ligue-1", "reims-big-2020": "ligue-1", "toulouse-big-768x768": "ligue-1",
  "bayern-munich-big-768x768": "bundesliga", "borussia-dortmund": "bundesliga", "bayer-04-leverkusen": "bundesliga", "rb-leipzig-big-587x300": "bundesliga", "eintracht-frankfurt-big-768x768": "bundesliga", "borussia-monchengladbach-big": "bundesliga", stuttgart: "bundesliga", wolfsburg: "bundesliga", "werder-bremen-big": "bundesliga", "hamburger-big-405x300": "bundesliga", "schalke-04-big-768x768": "bundesliga", "koln-big": "bundesliga", "hertha-big-768x715": "bundesliga",
  "stuttgart-big": "bundesliga", "wolfsburg-big-768x768": "bundesliga", "augsburg-big": "bundesliga", "freiburg-big": "bundesliga", "hoffenheim-big": "bundesliga", "mainz-05-big-768x715": "bundesliga", "union-berlin-big-768x280": "bundesliga", "hannover-96-big-768x677": "bundesliga", "1._FC_Nürnberg_logo.svg": "bundesliga",
  atalanta: "serie-a", bologna: "serie-a", "como-1907-big-768x794": "serie-a", fiorentina: "serie-a", "inter-milan": "serie-a", juventus: "serie-a", lazio: "serie-a", milan: "serie-a", napoli: "serie-a", "roma-big (1)": "serie-a", torino: "serie-a", "genoa-big-2022": "serie-a", sampdoria: "serie-a", parma: "serie-a", "udinese-big-768x765": "serie-a",
  "bologna-big": "serie-a", "fiorentina-big-2022-768x768": "serie-a", "lazio-big-443x300": "serie-a", "napoli-big-2024-768x768": "serie-a", "torino-big": "serie-a", "sampdoria-big": "serie-a", "parma-big": "serie-a", "sassuolo-big": "serie-a", "cagliari-big": "serie-a", "lecce-big-2023": "serie-a", "empoli-big-2021": "serie-a", "Hellas_verona_logo_3": "serie-a",
};

const CLUBS: ClubDefinition[] = [
  { fileName: "ajax-amsterdam-big-768x773.png", name: "Аякс" },
  { fileName: "al-hilal-saudi-big.png", name: "Аль-Хиляль" },
  { fileName: "al-nassr-big-2025-768x768.png", name: "Аль-Наср" },
  { fileName: "arsenal.png", name: "Арсенал" },
  { fileName: "aston-villa.png", name: "Астон Вилла" },
  { fileName: "atalanta.png", name: "Аталанта" },
  { fileName: "athletic-club-big-2013 (1).png", name: "Атлетик Бильбао" },
  { fileName: "atletico-madrid.png", name: "Атлетико Мадрид" },
  { fileName: "barcelona.png", name: "Барселона" },
  { fileName: "bayer-04-leverkusen.png", name: "Байер 04" },
  { fileName: "bayern-munich-big-768x768.png", name: "Бавария" },
  { fileName: "benfica.png", name: "Бенфика" },
  { fileName: "bologna-big.png", name: "Болонья" },
  { fileName: "borussia-dortmund.png", name: "Боруссия Дортмунд" },
  { fileName: "bournemouth-big.png", name: "Борнмут" },
  { fileName: "brentford-big-768x768.png", name: "Брентфорд" },
  { fileName: "brighton-hove-albion-big-768x773.png", name: "Брайтон" },
  { fileName: "burnley-big-2023 (1).png", name: "Бернли" },
  { fileName: "celtic-big-768x768.png", name: "Селтик" },
  { fileName: "chelsea.png", name: "Челси" },
  { fileName: "como-1907-big-768x794.png", name: "Комо" },
  { fileName: "crystal-palace-big-2022.png", name: "Кристал Пэлас" },
  { fileName: "eintracht-frankfurt-big-768x768.png", name: "Айнтрахт Франкфурт" },
  { fileName: "everton-big-768x786.png", name: "Эвертон" },
  { fileName: "fenerbahce.png", name: "Фенербахче" },
  { fileName: "fiorentina-big-2022-768x768.png", name: "Фиорентина" },
  { fileName: "flamengo-big.png", name: "Фламенго" },
  { fileName: "fulham-big.png", name: "Фулхэм" },
  { fileName: "galatasaray-big.png", name: "Галатасарай" },
  { fileName: "girona-big-768x768.png", name: "Жирона" },
  { fileName: "inter-milan.png", name: "Интер" },
  { fileName: "juventus.png", name: "Ювентус" },
  { fileName: "lazio-big-443x300.png", name: "Лацио" },
  { fileName: "leeds-united-big (1).png", name: "Лидс Юнайтед" },
  { fileName: "leicester-city-big-768x768.png", name: "Лестер" },
  { fileName: "lille-big-768x731.png", name: "Лилль" },
  { fileName: "liverpool.png", name: "Ливерпуль" },
  { fileName: "lyon-big-2022.png", name: "Лион" },
  { fileName: "manchester-city.png", name: "Манчестер Сити" },
  { fileName: "manchester-united.png", name: "Манчестер Юнайтед" },
  { fileName: "marseille.png", name: "Марсель" },
  { fileName: "milan.png", name: "Милан" },
  { fileName: "monaco.png", name: "Монако" },
  { fileName: "napoli-big-2024-768x768.png", name: "Наполи" },
  { fileName: "newcastle-united-big-768x774.png", name: "Ньюкасл Юнайтед" },
  { fileName: "nottingham-forest-big.png", name: "Ноттингем Форест" },
  { fileName: "porto.png", name: "Порту" },
  { fileName: "psg-big-768x768.png", name: "ПСЖ" },
  { fileName: "psv-eindhoven-big-768x630.png", name: "ПСВ" },
  { fileName: "rangers-big-2020-768x768.png", name: "Рейнджерс" },
  { fileName: "rb-leipzig-big-587x300.png", name: "РБ Лейпциг" },
  { fileName: "real-betis.png", name: "Реал Бетис" },
  { fileName: "real-madrid.png", name: "Реал Мадрид" },
  { fileName: "real-sociedad-big.png", name: "Реал Сосьедад" },
  { fileName: "river-plate-big.png", name: "Ривер Плейт" },
  { fileName: "roma-big (1).png", name: "Рома" },
  { fileName: "sevilla-big.png", name: "Севилья" },
  { fileName: "sporting.png", name: "Спортинг" },
  { fileName: "strasbourg-big-768x768.png", name: "Страсбург" },
  { fileName: "sunderland-big-768x640 (1).png", name: "Сандерленд" },
  { fileName: "tottenham-hotspur.png", name: "Тоттенхэм" },
  { fileName: "valencia-big.png", name: "Валенсия" },
  { fileName: "villarreal-big.png", name: "Вильярреал" },
  { fileName: "west-ham-united.png", name: "Вест Хэм" },
  { fileName: "wolverhampton-wanderers-big-768x666.png", name: "Вулверхэмптон" },
  { fileName: "southampton-big.png", name: "Саутгемптон" },
  { fileName: "blackburn-rovers-big-768x795.png", name: "Блэкберн" },
  { fileName: "norwich-city-big-2022.png", name: "Норвич" },
  { fileName: "celta-vigo-big.png", name: "Сельта" },
  { fileName: "Deportivo-La-Coruna.png", name: "Депортиво" },
  { fileName: "espanyol-big.png", name: "Эспаньол" },
  { fileName: "Real_Zaragoza_logo.svg.png", name: "Реал Сарагоса" },
  { fileName: "torino-big.png", name: "Торино" },
  { fileName: "genoa-big-2022.png", name: "Дженоа" },
  { fileName: "sampdoria-big.png", name: "Сампдория" },
  { fileName: "parma-big.png", name: "Парма" },
  { fileName: "udinese-big-768x765.png", name: "Удинезе" },
  { fileName: "borussia-monchengladbach-big.png", name: "Боруссия М" },
  { fileName: "stuttgart-big.png", name: "Штутгарт" },
  { fileName: "wolfsburg-big-768x768.png", name: "Вольфсбург" },
  { fileName: "werder-bremen-big.png", name: "Вердер" },
  { fileName: "hamburger-big-405x300.png", name: "Гамбург" },
  { fileName: "schalke-04-big-768x768.png", name: "Шальке" },
  { fileName: "koln-big.png", name: "Кёльн" },
  { fileName: "hertha-big-768x715.png", name: "Герта" },
  { fileName: "nice-big.png", name: "Ницца" },
  { fileName: "rennes-big.png", name: "Ренн" },
  { fileName: "lens-big.png", name: "Ланс" },
  { fileName: "bordeaux-big.png", name: "Бордо" },
  { fileName: "saint-etienne-big-2022.png", name: "Сент-Этьен" },
  { fileName: "nantes-big-2020.png", name: "Нант" },
  { fileName: "montpellier-big-768x768.png", name: "Монпелье" },
  { fileName: "feyenoord-big-768x768.png", name: "Фейеноорд" },
  { fileName: "az-alkmaar-big-612x300.png", name: "АЗ" },
  { fileName: "twente-big.png", name: "Твенте" },
  { fileName: "S.C._Braga_logo.svg.png", name: "Брага" },
  { fileName: "besiktas-big.png", name: "Бешикташ" },
  { fileName: "Trabzonspor_(logo).png", name: "Трабзонспор" },
  { fileName: "zenit-big-2023-400x263.png", name: "Зенит" },
  { fileName: "spartak-moskva-big-2022-new-400x281.png", name: "Спартак" },
  { fileName: "cska-moskva-big.png", name: "ЦСКА" },
  { fileName: "dynamo-kyiv-big.png", name: "Динамо К" },
  { fileName: "shakhtar-donetsk-big.png", name: "Шахтёр" },
  { fileName: "olympiacos-big.png", name: "Олимпиакос" },
  { fileName: "panathinaikos-big-768x768.png", name: "Панатинаикос" },
  { fileName: "aek-athens-big.png", name: "АЕК" },
  { fileName: "brugge-big.png", name: "Брюгге" },
  { fileName: "anderlecht-big-768x757.png", name: "Андерлехт" },
  { fileName: "red-bull-salzburg-big-768x780 (1).png", name: "Зальцбург" },
  { fileName: "basel-big.png", name: "Базель" },
  { fileName: "palmeiras-big-768x768.png", name: "Палмейрас" },
  { fileName: "corinthians-big.png", name: "Коринтианс" },
  { fileName: "santos-big.png", name: "Сантос" },
  { fileName: "sao-paulo-big-768x765.png", name: "Сан-Паулу" },
  { fileName: "gremio-big.png", name: "Гремио" },
  { fileName: "boca-juniors-big.png", name: "Бока Хуниорс" },
  { fileName: "independiente-big.png", name: "Индепендьенте" },
  { fileName: "Escudo_de_Racing_Club_(2014).svg.png", name: "Расинг" },
  { fileName: "America_S.A._de_C.V.png", name: "Америка" },
  { fileName: "crvena-zvezda-big.png", name: "Црвена Звезда" },
  { fileName: "slavia-praha-big-2022.png", name: "Славия" },
  { fileName: "sparta-prague-big-2021.png", name: "Спарта" },
  { fileName: "dinamo-zagreb-big-768x768.png", name: "Загреб" },
  { fileName: "legia-warsaw-big.png", name: "Легия" },
  { fileName: "apoel-big.png", name: "АПОЭЛ" },
  { fileName: "kobenhavn-big-768x768.png", name: "Копенгаген" },
  { fileName: "malmo-big.png", name: "Мальмё" },
  { fileName: "ludogorets-big.png", name: "Лудогорец" },
  // Recently uploaded badges for the expanded top-five leagues
  { fileName: "everton-big-768x786.png", name: "Эвертон" },
  { fileName: "getafe-big.png", name: "Хетафе" },
  { fileName: "osasuna-big.png", name: "Осасуна" },
  { fileName: "rayo-vallecano-big-768x682.png", name: "Райо Вальекано" },
  { fileName: "mallorca-big.png", name: "Мальорка" },
  { fileName: "real-valladolid-big-2022.png", name: "Реал Вальядолид" },
  { fileName: "Deportivo-La-Coruna (1).png", name: "Депортиво Ла-Корунья" },
  { fileName: "Real_Zaragoza_logo.svg.webp", name: "Реал Сарагоса" },
  { fileName: "valencia-big (1).png", name: "Валенсия" },
  { fileName: "auxerre-big.png", name: "Осер" },
  { fileName: "brest-big.png", name: "Брест" },
  { fileName: "clermont-big.png", name: "Клермон" },
  { fileName: "lorient-big.png", name: "Лорьян" },
  { fileName: "metz-big-2021.png", name: "Мец" },
  { fileName: "reims-big-2020.png", name: "Реймс" },
  { fileName: "toulouse-big-768x768.png", name: "Тулуза" },
  { fileName: "augsburg-big.png", name: "Аугсбург" },
  { fileName: "freiburg-big.png", name: "Фрайбург" },
  { fileName: "hoffenheim-big.png", name: "Хоффенхайм" },
  { fileName: "mainz-05-big-768x715.png", name: "Майнц 05" },
  { fileName: "union-berlin-big-768x280.png", name: "Унион Берлин" },
  { fileName: "hannover-96-big-768x677.png", name: "Ганновер 96" },
  { fileName: "1._FC_Nürnberg_logo.svg.webp", name: "Нюрнберг" },
  { fileName: "sassuolo-big.png", name: "Сассуоло" },
  { fileName: "cagliari-big.png", name: "Кальяри" },
  { fileName: "lecce-big-2023.png", name: "Лечче" },
  { fileName: "empoli-big-2021.png", name: "Эмполи" },
  { fileName: "Hellas_verona_logo_3.png", name: "Верона" },];

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

        const leagueSlug = TOP_FIVE_CLUB_LEAGUES[slug] ?? null;
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
