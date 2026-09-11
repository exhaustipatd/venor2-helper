# Venor Helper

Magyar nyelvű, nem hivatalos Venor2 játéksegédlet. Vue 3 + TypeScript + Pinia, statikus GitHub Pages tárhely, helyben tárolt adatok. Nincs fiók, háttérszerver vagy élő piaci adatkapcsolat.

## Funkciók

- **Áttekintés:** pozitív becsült eredményű cserék, hiányzó árak prioritása, gyűjtemény és célok.
- **Cserekereső:** piaci vásárlás és körmentes, láncolt NPC-váltások; kompakt, közvetlenül szerkeszthető alapanyagárak és beszerzési útvonalak.
- **Mennyiségtervező:** egész váltási csomagok, bevásárlólista, sorrendbe rendezett lépések és megmaradó tárgyak; külön gombbal nyitható meg.
- **NPC-boltok:** keresés kereskedőre, ajánlatra és VNUM-ra; mindig látható, kompakt receptek; NPC-nként mentett kapcsoló. Az inaktív NPC-k böngészhetők, de a teljes beszerzési láncból kimaradnak. A szél kereskedő alapból inaktív.
- **Kisállatok:** egységes gyűjteménykártyák, bónuszszűrés, megszerzett állapot, kitűzött célok, helyben átfordítható kártyák kompakt alapanyaglistával és gombbal nyitható bónuszösszesítő.
- **Árlista:** egységes saját árak, hét napnál régebbi árak jelzése, továbbváltások, játékbeli JSON import és export.
- **Biztonsági mentések:** v2, v3 és v4 import, teljes csere előtti megerősítés, export, tárhelyhiba-jelzés.
- **Obsidian & Jade:** sötét obszidián/jade/arany és világos elefántcsont téma; helyi betűk és tárgyikonok.

## Indítás

Node.js **24** szükséges (a CI is ezt használja).

```bash
npm ci
npm run dev
```

Éles build és helyi megtekintés:

```bash
npm run build
npm run preview
```

A publikált alkalmazás: **https://exhaustipatd.github.io/venor2-helper/**

A navigáció hash-alapú. A keresések és kiválasztások az URL-ben maradnak, ezért megoszthatók. A `VITE_BASE_PATH` környezeti változóval állítható a publikálási alkönyvtár.

## Árak és számítások

Az ármezők értik a `k`, `kk`, `kkk`, `kkkk`, `m`, `mrd` és `b` rövidítést. **1b = 1 billió Yang.** Példák: `500kk`, `1,5mrd`, `1 250 000`. A feldolgozás egész `BigInt` aritmetikát használ, nem lebegőpontos szorzást. Hibás és negatív ár nem írja felül a korábbi értéket.

- Enter vagy mezőelhagyás: mentés.
- Escape: a szerkesztés elvetése.
- Üres mező: hiányzó ár. A nulla érvényes, ingyenes ár.
- Egyetlen saját egységárat használunk vételre és becsült eladásra is.
- A cserekártyák egységár-becslései felfelé kerekítettek; nem azonosak a tényleges csomagbeszerzés készpénzigényével.
- A mennyiségtervező a kiválasztott alapanyagútvonal teljes csomagköltségét számolja, és újra felhasználja a maradékokat.
- A tervező összehasonlítja a közvetlen piacot és a rendelkezésre álló gyökérrecepteket. **Nem keres minden receptkombináció között globális mennyiségi optimumot.**
- Körkörös váltás, nem árazott Gaya/más valuta, hiányzó ár nem szerepel teljes Yang-tervként.
- Nincs piaci készlet-, eladhatósági, adó- vagy meglévő játékbeli készletfeltételezés. A profit becslés, nem garancia. A maradék tárgyak nem számítanak automatikusan eladási bevételnek.

## Helyi mentések

- Új mentés: `venor-helper:user-data:v4` (`prices`, `ownedPets`, `targetPets`, `npcEnabled`).
- Korábbi mentések: először v3, majd v2, kizárólag ha újabb kulcs még nem létezik. Az eredeti kulcsokat nem töröljük; sérült újabb mentés esetén nem térünk vissza régebbihez.
- Az `npcEnabled` NPC-VNUM alapján tárolja az egyéni kapcsolókat. Beállítás nélkül a 60033-as szél kereskedő inaktív, minden más NPC aktív. A régi mentések ezt az alapértéket kapják.
- Téma: `venor-helper:theme`.
- Sérült mentés esetén az automatikus felülírás blokkolt; az eredeti adat külön letölthető. Ellenőrzött mentés visszaállítása vagy megerősített törlés oldja fel a blokkolást.
- A tárhely írási hibái látható figyelmeztetést kapnak. Ilyenkor tölts le JSON-mentést, mielőtt bezárod az oldalt.
- A mentés visszaállítása **teljes csere**, nem összevonás. A játékbeli árimport csak az érintett árakat írja felül.
- Importméret: legfeljebb 5 MB. Játékbeli árakhoz a `C:\Venor2\shop\price_history_vnum.json` fájl használható, nem a hash-változat. Az árlista exportja ugyanezzel a fájlnévvel és formátumban készül; minden mentett egységár `count: 1` sor lesz.

## Wiki-adatok karbantartása

A gyűjtés a saját, normál Chrome-böngésződ megnyitott wiki lapján fut. A `tools/wiki-browser-extension` mappát töltsd be a `chrome://extensions` oldalon (**Fejlesztői mód → Kicsomagolt bővítmény betöltése**). Nyisd meg a wiki kisállat-kategóriáját, majd kattints a bővítményre és a **Start / resume** gombra. Ezután önállóan feldolgozza az összes kisállatot és NPC-receptet, és JSON-fájlt exportál.

```bash
npm run sync-data -- --capture "<letöltött JSON elérési útja>" --dry-run
npm run sync-data -- --offline
npm run validate-data
```

A szinkronizáló parancs kizárólag helyi fájlt importál: nem indít böngészőt, és nem küld hálózati kérést. A bővítmény az oldal elemeit és tooltipjeit olvassa, közvetlen API-hívás nélkül. Minden recept után ment, hiba esetén újrapróbálkozás nélkül leáll. A hiányos export nem írhatja felül a katalógust.

Telepítés, folytatás, adatösszevonás és korlátok: [docs/WIKI-CAPTURE.md](docs/WIKI-CAPTURE.md). A 2026-09-10-i teljes böngészős export sikeresen frissítette a helyi katalógust: 37 NPC-bolt, 870 recept és 70 kisállat.

## Fejlesztés

```bash
npm run lint           # ESLint: TypeScript és Vue
npm run format         # Prettier
npm run format:check
npm run validate-data  # Sémák, hivatkozások és helyi ikonok
npm test               # Meglévő Vitest egységtesztek
npm run check          # Ellenőrzések + egységtesztek + build
```

A pull requestek ellenőrzést kapnak; a `main` ágra pusholt, sikeresen ellenőrzött build a GitHub Pages-re kerül. A bővítmény külön offline böngészős tesztje: `npm run test:wiki-extension`. A felület ellenőrzése kézi.

A kódszerkezet és a kézi ellenőrzőlista: [docs/MAINTENANCE.md](docs/MAINTENANCE.md).
