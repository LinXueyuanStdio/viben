import type { PaperSource } from "../types";
import { ArxivSearcher } from "./arxiv";
import { CORESearcher, IEEESearcher, ScienceDirectSearcher, ScopusSearcher, SpringerSearcher, WOSSearcher } from "./api-sources";
import { CrossRefSearcher } from "./crossref";
import { GoogleScholarSearcher } from "./google-scholar";
import { IACRSearcher } from "./iacr";
import { PMCSearcher } from "./pmc";
import { BioRxivSearcher, MedRxivSearcher } from "./preprint";
import { PubMedSearcher } from "./pubmed";
import { SemanticSearcher } from "./semantic";
import { EmptySearchInstitutionalSource } from "./simple";
import { loadBrowsePluginSources } from "../plugins";

export { ArxivSearcher } from "./arxiv";
export { CORESearcher, IEEESearcher, ScienceDirectSearcher, ScopusSearcher, SpringerSearcher, WOSSearcher } from "./api-sources";
export { CrossRefSearcher } from "./crossref";
export { GoogleScholarSearcher } from "./google-scholar";
export { IACRSearcher } from "./iacr";
export { PMCSearcher } from "./pmc";
export { BioRxivSearcher, MedRxivSearcher } from "./preprint";
export { PubMedSearcher } from "./pubmed";
export { EmptySearchInstitutionalSource, UnsupportedMetadataSource } from "./simple";

export function createDefaultSources(): Record<string, PaperSource> {
  return {
    arxiv: new ArxivSearcher(),
    pubmed: new PubMedSearcher(),
    pmc: new PMCSearcher(),
    biorxiv: new BioRxivSearcher(),
    medrxiv: new MedRxivSearcher(),
    semantic: new SemanticSearcher(),
    core: new CORESearcher(),
    crossref: new CrossRefSearcher(),
    iacr: new IACRSearcher(),
    acm: new EmptySearchInstitutionalSource(
      "acm",
      "ACM PDF download requires institutional access",
      "PDF not found: {path}. ACM requires institutional access for PDF download."
    ),
    sciencedirect: new ScienceDirectSearcher(),
    springer: new SpringerSearcher(),
    ieee: new IEEESearcher(),
    scopus: new ScopusSearcher(),
    wos: new WOSSearcher(),
    jstor: new EmptySearchInstitutionalSource(
      "jstor",
      "JSTOR PDF download requires institutional access",
      "PDF not found: {path}. JSTOR requires institutional access."
    ),
    researchgate: new EmptySearchInstitutionalSource(
      "researchgate",
      "ResearchGate PDF download requires account and author permission",
      "PDF not found: {path}. ResearchGate requires manual download."
    ),
    google_scholar: new GoogleScholarSearcher(),
    ...loadBrowsePluginSources(),
  };
}
