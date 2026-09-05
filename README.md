# Venor Helper

Magyar nyelvű, nem hivatalos Venor2 játéksegédlet. Vue 3 + TypeScript + Pinia, statikus GitHub Pages tárhely, helyben tárolt adatok. Nincs fiók, háttérszerver vagy élő piaci adatkapcsolat.

## Funkciók

- **Áttekintés:** pozitív becsült eredményű cserék, hiányzó árak prioritása, gyűjtemény és célok.
- **Cserekereső:** piaci vásárlás és körmentes, láncolt NPC-váltások; kinyitható beszerzési útvonalak.
- **Mennyiségtervező:** egész váltási csomagok, bevásárlólista, sorrendbe rendezett lépések és megmaradó tárgyak.
- **NPC-boltok:** keresés kereskedőre, ajánlatra és VNUM-ra; összecsukható receptek.
- **Kisállatok:** egységes gyűjteménykártyák, bónuszszűrés, megszerzett állapot, kitűzött célok, részletpanel.
- **Árlista:** egységes saját árak, hét napnál régebbi árak jelzése, továbbváltások, importálási előnézet.
- **Biztonsági mentések:** v2 és v3 import, teljes csere előtti megerősítés, export, tárhelyhiba-jelzés.
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

- Új mentés: `venor-helper:user-data:v3` (`prices`, `ownedPets`, `targetPets`).
- Korábbi mentés: `venor-helper:user-data:v2`. Automatikusan beolvassuk, ha még nincs v3. Az eredeti v2 kulcsot nem töröljük.
- Téma: `venor-helper:theme`.
- Sérült mentés esetén az automatikus felülírás blokkolt; az eredeti adat külön letölthető. Ellenőrzött mentés visszaállítása vagy megerősített törlés oldja fel a blokkolást.
- A tárhely írási hibái látható figyelmeztetést kapnak. Ilyenkor tölts le JSON-mentést, mielőtt bezárod az oldalt.
- A mentés visszaállítása **teljes csere**, nem összevonás. A játékbeli árimport csak az érintett árakat írja felül.
- Importméret: legfeljebb 5 MB. Játékbeli árakhoz a `C:\Venor2\shop\price_history_vnum.json` fájl használható, nem a hash-változat.

## Wiki-adatok karbantartása

Először csak ellenőrizd a változásokat:

```bash
npm run sync-data -- --dry-run
```

Frissítés:

```bash
npm run sync-data
npm run validate-data
```

A szinkronizáló:

1. Helyreállítja az esetleg félbeszakadt csomagcserét.
2. Legalább 10 másodperces szünettel lekéri a tárgyakat és boltokat. Kérésenként 30 másodperces időkorlát és legfeljebb négy próbálkozás van.
3. Ellenőrzi a sémát, egész számokat, azonosítókat, árakat és kisállatok jelenlétét.
4. Tíz százaléknál nagyobb elemszámcsökkenésnél megáll. Kézi ellenőrzés után a `--allow-shrink` kapcsoló engedélyezi.
5. Az új csomagot külön mappába készíti el. A régi csomag biztonsági másolata megmarad a publikálásig; sikertelen csere esetén visszaállítja.

A frissítés **nem kér le médiafájlokat**, és megőrzi a kézi javításokat (`item-overrides.json`, `shop-overrides.json`). Egy boltban a javítás az azonos eredménytárgyhoz tartozó wiki-ajánlatokat helyettesíti. Más tárgy ajánlatsorrendjével ütköző javítás érvénytelen csomagot jelent, nem csendes törlést.

A `VENOR_SYNC_DELAY_MS` növeli a kérések közti szünetet. A `VENOR_WIKI_URL` alternatív forrást adhat meg. Egyszerre csak egy szinkronizálás futhat. Folyamatösszeomlás után, **ha biztosan nem fut másik szinkronizálás**, törölhető a `.venor-sync-lock` mappa, majd a parancs újrafuttatható. Ne töröld kézzel a `public/data.backup` helyreállítási mappát.

Helyi ikonleképezések újraépítése:

```bash
npm run rebuild-icon-map
```

Ez csak helyi fájlokat olvas. Új ikonok beszerzése külön, kézi feladat.

## Fejlesztés

```bash
npm run lint           # ESLint: TypeScript és Vue
npm run format         # Prettier
npm run format:check
npm run validate-data  # Sémák, hivatkozások és helyi ikonok
npm test               # Meglévő Vitest egységtesztek
npm run check          # Ellenőrzések + egységtesztek + build
```

A pull requestek ellenőrzést kapnak; a `main` ágra pusholt, sikeresen ellenőrzött build a GitHub Pages-re kerül. Böngészős tesztkeretrendszer nincs a projektben; a felület ellenőrzése kézi.

A kódszerkezet és a kézi ellenőrzőlista: [docs/MAINTENANCE.md](docs/MAINTENANCE.md).
