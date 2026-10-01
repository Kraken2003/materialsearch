# Material Atlas

Material Atlas helps you find materials by their element composition and explore the research around them. Select elements on a periodic table, search materials databases, and open a result to inspect its properties, source references, and related papers.

It is useful when you know the elements you want to investigate but have not settled on a specific compound. For example, selecting iron and oxygen lets you browse iron oxide records, follow their original database entries, and look for research on magnetic properties or synthesis.

## Search workflow

1. Select the elements a material must include. Switch to **Exclude elements** to rule out elements you want to avoid.
2. Choose a match mode. **Contains all selected elements** allows additional elements; **Only these elements** limits results to the selected element set.
3. Click **Search materials**. Results arrive from the available databases, with a separate status for each source.
4. Open a record to see its available properties, original database link, references, and source attribution. Related papers are searched automatically; add keywords to refine that search.
5. Load more results from individual databases, export the loaded records as CSV, or copy a link to share the composition search.

The example compositions provide starting selections for iron oxides, lithium–iron–phosphorus–oxygen battery materials, and silicon oxides. Select an example, then run the search.

### Matching elements

With Fe and O selected, **Contains all selected elements** can return compounds containing iron and oxygen alongside other elements. **Only these elements** returns records containing just iron and oxygen, across different ratios such as FeO and Fe₂O₃. Neither mode specifies a particular formula ratio.

Excluded elements are rejected in either mode. Composition matches describe the elements present; they do not establish a material's suitability for a particular application.

## How it works

The browser sends your composition to the app's server, which queries the available materials databases independently. COD and Materials Cloud work without API keys. Materials Project becomes available when the site owner configures access.

The server converts each database response into a common record format and checks that its elements match your selection. Results are grouped by formula, while distinct database records remain separate. Each record retains its source link, attribution, and retrieval time so you can trace it back to the original entry.

Opening a record starts a separate literature search through Crossref and, when configured, OpenAlex. The search uses the material's formula, formula aliases, element names, and any keywords you add. Duplicate papers are combined, and open-access links are shown when available.

A database outage is reported beside that source; successful results from other databases remain usable. Missing references or a failed literature search also leave the material record visible and exportable. Failed live requests are never replaced with demo results.

## Sources and interpreting results

| Source | Contribution |
| --- | --- |
| COD | Experimental crystal-structure records. |
| Materials Cloud MC3D | Computed relaxed crystal structures. |
| Materials Project | Computed material records and properties, when access is configured. |
| Crossref | Publication metadata and links for related research. |
| OpenAlex | Additional publication metadata and open-access links, when access is configured. |

Properties depend on the source. A record may include a space group, cell volume, band gap, or energy above hull; missing values are marked unavailable. Check the original record and calculation methods before comparing values across databases.

Database-supplied record references, general dataset citations, and papers discovered through search are labeled separately. A related paper is a candidate for further reading; its appearance does not establish that it studied or validated the exact structure. Literature searches can miss relevant work.

CSV exports contain only the records currently loaded, including source identifiers, available properties, references, and attribution. Load additional pages before exporting if you need more records. Shared search links preserve the composition query, rather than a fixed snapshot of the results.

See [source attribution and reuse terms](TECHNICAL.md#data-sources-and-reuse) before reusing database records.

## Run locally

Use Node.js 22.12+ or 24.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). The default setup can search COD, Materials Cloud, and Crossref without keys. Optional Materials Project and OpenAlex credentials belong in `.env.local`; restart the server after changing them.

## Technical documentation

The [technical guide](TECHNICAL.md) contains:

- [Local setup and optional credentials](TECHNICAL.md#run-locally)
- [Data sources, attribution, and reuse terms](TECHNICAL.md#data-sources-and-reuse)
- [Vercel deployment and production configuration](TECHNICAL.md#public-deployment-on-vercel)
- [Quotas, caching, and failure behavior](TECHNICAL.md#quotas-and-failure-behavior)
- [API request and response contracts](TECHNICAL.md#api)
- [Tests and live verification commands](TECHNICAL.md#verify)
- [Adding a materials source](TECHNICAL.md#extending-sources)
