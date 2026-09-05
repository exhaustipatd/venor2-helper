# Venor Helper

Magyar nyelvű Vue 3 webalkalmazás a Venor2 NPC-boltjaihoz, piaci áraihoz és kisállat-gyűjteményéhez.

## Funkciók

- NPC-k és összes bolti ajánlatuk
- tárgyalapú csereköltségek és profit számítása
- külön csere-összehasonlító piaci vásárlással, láncolt NPC-váltásokkal és profit szerinti rangsorral
- egységes piaci árak helyi mentése
- külön Kisállatok oldal név-, bónusz- és gyűjteményszűrővel
- megszerzett kisállatok jelölése
- magyar számformátum és Metin2-es `k`, `kk`, `kkk`, `kkkk`, `b` árbevitel (`1b` = 1 billió)
- JSON biztonsági mentés és visszaállítás
- helyben tárolt tárgyikonok
- reszponzív világos és sötét téma, rendszerbeállítás szerinti első választással

## Indítás

```bash
npm install
npm run dev
```

Éles build:

```bash
npm run build
npm run preview
```

## GitHub Pages

Az alkalmazás itt érhető el: **https://exhaustipatd.github.io/venor2-helper/**

A `main` ágra történő minden push után a [Deploy to GitHub Pages](https://github.com/exhaustipatd/venor2-helper/actions/workflows/deploy-pages.yml) workflow futtatja a teszteket, elkészíti az éles buildet, majd publikálja az oldalt. A GitHub Pages alatti közvetlen navigáció megbízhatósága érdekében a publikált alkalmazás hash-alapú útvonalakat használ.

## Wiki-adatok frissítése

A tárgyak, kisállatok, NPC-boltok és ajánlatok óvatos frissítése:

```bash
npm run sync-data
```

A szinkronizáló **semmilyen ikont vagy médiafájlt nem kér le**, és a meglévő helyi képeket érintetlenül hagyja. A külön, böngészőből importált ikonok VNUM-leképezése újraépíthető:

```bash
npm run rebuild-icon-map
```

Ez a parancs kizárólag a helyi adat- és képfájlokat olvassa; nem indít hálózati kérést.

A két adatlekérés között alapértelmezetten 10 másodperc szünet van. Ez a `VENOR_SYNC_DELAY_MS` környezeti változóval növelhető. A szinkronizáló csak akkor írja felül az adatfájlokat, ha a tárgy-, bolt- és kisállatadatokat is sikeresen ellenőrizte.

A wikiből hiányzó vagy javított kézi ajánlatok a `public/data/shop-overrides.json` fájlban vannak. Betöltéskor ezek felülírják az azonos boltban, azonos eredménytárgyhoz tartozó wiki-ajánlatot, ezért egy későbbi szinkronizálás sem törli őket.

## Stílusok

- `src/styles/colors.css`: központi világos/sötét színváltozók
- `src/styles/common.css`: újrahasznált globális elemek
- `src/components/*.css`: komponensekhez rendelt stílusok
- `src/views/*.css`: oldalankénti stílusok

A betűkészletek is helyileg, az alkalmazás buildjében találhatók.

## Helyi adatok

A felhasználói árak és a gyűjtemény a `venor-helper:user-data:v2`, a témaválasztás pedig a `venor-helper:theme` localStorage-kulcs alatt tárolódik. A Beállítások oldalon az árak és a gyűjtemény exportálhatók és importálhatók.
