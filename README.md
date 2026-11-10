# Skjer lokalt

Oversikt over arrangementer i norske byer de neste 30 dagene. Første by: Kristiansand.
Nettside: https://skjerlokalt.no (test, skjult for søkemotorer).

## Slik henger det sammen

- `index.html` – forsiden med byvalg.
- `kristiansand/index.html` – programsiden for Kristiansand.
- `assets/app.js` og `assets/style.css` – felles kode og stil for alle byer.
- `assets/fonts/` – skriftene Bricolage Grotesque og Instrument Sans (SIL Open Font License), lagt her så siden ikke henter noe fra Google.
- `data/kristiansand.json` – programmet. Filen skrives hver morgen av en planlagt oppgave i Claude.

Siden er helt statisk og publiseres med GitHub Pages fra grenen `main`.

## Ny by

1. Kopier `kristiansand/` til en ny mappe, f.eks. `arendal/`, og bytt `data-by` og titler i `index.html`.
2. Legg til datafilen `data/arendal.json` (samme format).
3. Legg byen til på forsiden.

## Dataformat

Toppnivå: `oppdatert` (ISO 8601), `periode_dager`, `arrangementer`, `kilder`, `rapport`.
Hvert arrangement: `id`, `tittel`, `beskrivelse`, `kategorier` (konsert, klassisk, scene, humor, familie, jul, marked, sport, annet), `dato`, `slutt_dato`, `tider` ({`kl`, `billett`}), `sted`, `pris`, `gratis`, `aldersgruppe`, `kilde_navn`, `kilde_url`, `sist_sjekket`, `status` (bekreftet, må_sjekkes, avlyst).
