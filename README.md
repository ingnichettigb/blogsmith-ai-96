# BlogBoost AI

Crea una piattaforma SaaS ("BlogEngine AI") per generare e alimentare blog professionali su qualsiasi sito web, partendo dalla schermata principale con analisi URL e gestione dei prodotti sponsorizzati nella sidebar:

1. Design e Leggibilità:
- Caratteri grandi, nitidi e ad altissimo contrasto per massima leggibilità (accessibilità elevata).
- Layout mobile-first perfettamente ottimizzato per l'uso anche da smartphone, con pulsanti ampi e schede ordinate.
- Tema chiaro e scuro ad alto contrasto.

2. Schermata Principale con Analisi URL del Sito:
- Campo in alto per inserire l'URL di un sito web da analizzare con pulsante di scansione.
- Riconoscimento estetico (palette colori, tipografia, logo) e stack tecnologico.
- Rilevamento presenza o assenza del blog (/blog, /news, /articoli).
- Mappa visiva dell'albero delle cartelle (modello Content Folder: public/blog/[slug]/copertina.webp e src/content/blog/[slug].json o .md).
- Se il blog è assente: generazione automatica di un prompt dettagliato pronto da copiare per costruire la pagina base del blog (/blog e /blog/[slug]) clonando l'estetica del sito analizzato e predisponendo la cartella e la sidebar destra.

3. Gestione Prodotti / Servizi Sponsorizzati (Sidebar a rotazione):
- Modulo per configurare i prodotti o servizi da pubblicizzare sul proprio sito (titolo, descrizione, badge, link, immagine/icona).
- Predisposizione della fascia laterale destra fissa (sticky sidebar) nella vista articolo dove i prodotti compaiono a turno o a rotazione programmata.

4. Generatore di Articoli:
- Impostazione argomento/titolo con suggerimenti.
- Selettore obbligatorio del numero minimo di parole (preset 800, 1500, 2500+ parole o valore personalizzato).
- Modulo immagini: copertina 16:9 (creazione o selezione stock) e figure interne posizionate nei paragrafi.

5. Anteprima Live ed Esportazione:
- Doppia anteprima: Vetrina (/blog) e Articolo Singolo (/blog/slug) con la sidebar destra attiva e contatore parole in tempo reale.
- Esportazione del pacchetto pronto (.zip o file Markdown/JSON + cartella immagini) e istruzioni rapide di installazione.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://blogsmith-ai-96.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/88c4b47b-0a2a-47bb-8294-fa726d906a5a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
