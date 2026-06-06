import { existsSync } from "node:fs";
import { BasePaperSource, type ReadOptions, type SearchOptions } from "../types";
import { extractPdfPages } from "../types";
import { localPdfPath } from "./utils";

export class EmptySearchInstitutionalSource extends BasePaperSource {
  constructor(
    private readonly sourceName: string,
    private readonly downloadMessage: string,
    private readonly missingMessage: string
  ) {
    super();
  }

  search(_query: string, _options: SearchOptions = {}): [] {
    return [];
  }

  downloadPdf(): string {
    throw new Error(this.downloadMessage);
  }

  async readPaper(paperId: string, savePath = "./downloads", options: ReadOptions = {}): Promise<string> {
    const path = localPdfPath(savePath, `${paperId}.pdf`);
    if (!existsSync(path)) {
      throw new Error(this.missingMessage.replace("{path}", path));
    }
    return (await extractPdfPages(path, options)).trim();
  }

  get source(): string {
    return this.sourceName;
  }
}

export class UnsupportedMetadataSource extends BasePaperSource {
  constructor(
    private readonly searchMessage: string,
    private readonly downloadMessage: string,
    private readonly readMessage: string
  ) {
    super();
  }

  search(): [] {
    return [];
  }

  downloadPdf(): string {
    throw new Error(this.downloadMessage);
  }

  readPaper(): string {
    return this.readMessage;
  }

  get warning(): string {
    return this.searchMessage;
  }
}
