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
  { fileName: "leicester-city.png", name: "Лестер" },
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
  { fileName: "southampton.png", name: "Саутгемптон" },
  { fileName: "blackburn-rovers.png", name: "Блэкберн" },
  { fileName: "norwich-city.png", name: "Норвич" },
  { fileName: "celta-vigo.png", name: "Сельта" },
  { fileName: "deportivo-la-coruna.png", name: "Депортиво" },
  { fileName: "espanyol.png", name: "Эспаньол" },
  { fileName: "real-zaragoza.png", name: "Реал Сарагоса" },
  { fileName: "torino.png", name: "Торино" },
  { fileName: "genoa.png", name: "Дженоа" },
  { fileName: "sampdoria.png", name: "Сампдория" },
  { fileName: "parma.png", name: "Парма" },
  { fileName: "udinese.png", name: "Удинезе" },
  { fileName: "borussia-mg.png", name: "Боруссия М" },
  { fileName: "stuttgart.png", name: "Штутгарт" },
  { fileName: "wolfsburg.png", name: "Вольфсбург" },
  { fileName: "werder-bremen.png", name: "Вердер" },
  { fileName: "hamburger-sv.png", name: "Гамбург" },
  { fileName: "schalke-04.png", name: "Шальке" },
  { fileName: "koln.png", name: "Кёльн" },
  { fileName: "hertha-berlin.png", name: "Герта" },
  { fileName: "nice.png", name: "Ницца" },
  { fileName: "rennes.png", name: "Ренн" },
  { fileName: "lens.png", name: "Ланс" },
  { fileName: "bordeaux.png", name: "Бордо" },
  { fileName: "saint-etienne.png", name: "Сент-Этьен" },
  { fileName: "nantes.png", name: "Нант" },
  { fileName: "montpellier.png", name: "Монпелье" },
  { fileName: "feyenoord.png", name: "Фейеноорд" },
  { fileName: "az-alkmaar.png", name: "АЗ" },
  { fileName: "twente.png", name: "Твенте" },
  { fileName: "braga.png", name: "Брага" },
  { fileName: "besiktas.png", name: "Бешикташ" },
  { fileName: "trabzonspor.png", name: "Трабзонспор" },
  { fileName: "zenit.png", name: "Зенит" },
  { fileName: "spartak-moscow.png", name: "Спартак" },
  { fileName: "cska-moscow.png", name: "ЦСКА" },
  { fileName: "dynamo-kyiv.png", name: "Динамо К" },
  { fileName: "shakhtar-donetsk.png", name: "Шахтёр" },
  { fileName: "olympiacos.png", name: "Олимпиакос" },
  { fileName: "panathinaikos.png", name: "Панатинаикос" },
  { fileName: "aek-athens.png", name: "АЕК" },
  { fileName: "club-brugge.png", name: "Брюгге" },
  { fileName: "anderlecht.png", name: "Андерлехт" },
  { fileName: "salzburg.png", name: "Зальцбург" },
  { fileName: "basel.png", name: "Базель" },
  { fileName: "palmeiras.png", name: "Палмейрас" },
  { fileName: "corinthians.png", name: "Коринтианс" },
  { fileName: "santos.png", name: "Сантос" },
  { fileName: "sao-paulo.png", name: "Сан-Паулу" },
  { fileName: "gremio.png", name: "Гремио" },
  { fileName: "boca-juniors.png", name: "Бока Хуниорс" },
  { fileName: "independiente.png", name: "Индепендьенте" },
  { fileName: "racing-club.png", name: "Расинг" },
  { fileName: "club-america.png", name: "Америка" },
  { fileName: "red-star-belgrade.png", name: "Црвена Звезда" },
  { fileName: "slavia-prague.png", name: "Славия" },
  { fileName: "sparta-prague.png", name: "Спарта" },
  { fileName: "dinamo-zagreb.png", name: "Загреб" },
  { fileName: "legia-warsaw.png", name: "Легия" },
  { fileName: "apoel.png", name: "АПОЭЛ" },
  { fileName: "fc-copenhagen.png", name: "Копенгаген" },
  { fileName: "malmo.png", name: "Мальмё" },
  { fileName: "ludogorets.png", name: "Лудогорец" },
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
