import { promises as fs } from "fs";
import path from "path";

export type ClubOption = {
  slug: string;
  name: string;
  imagePath: string;
};

type ClubDefinition = {
  fileName: string;
  name: string;
};

const CLUBS_DIR = path.join(process.cwd(), "public", "club-badges");

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
  { fileName: "santos.png", name: "Сантос" },
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
];

function sortClubs(clubs: ClubOption[]) {
  return clubs.sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export async function getAvailableClubs() {
  try {
    const entries = await fs.readdir(CLUBS_DIR, { withFileTypes: true });
    const existingFileNames = new Set(
      entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
    );

    const clubs = CLUBS.filter((club) => existingFileNames.has(club.fileName)).map((club) => ({
      slug: path.basename(club.fileName, path.extname(club.fileName)),
      name: club.name,
      imagePath: `/club-badges/${club.fileName}`,
    }));

    return sortClubs(clubs);
  } catch {
    return [];
  }
}
