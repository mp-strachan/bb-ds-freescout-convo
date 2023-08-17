import {IntegrationBase} from "@budibase/types"
import fetch from "node-fetch"

interface Query {
  method: string
  body?: string
  headers?: { [key: string]: string }
}

class CustomIntegration implements IntegrationBase {
  private readonly url: string
  private readonly apikey: string

  constructor(config: { url: string; apikey: string }) {
    this.url = config.url
    this.apikey = config.apikey
  }

  async request(url: string, opts: Query) {
    const auth = { "X-FreeScout-API-Key": this.apikey, }
    opts.headers = opts.headers ? { ...opts.headers, ...auth } : auth

    const response = await fetch(url, opts)
    if (response.status <= 300) {
      try {
        const contentType = response.headers.get("content-type")
        if (contentType?.includes("json")) {
          return await response.json()
        } else {
          return await response.text()
        }
      } catch (err) {
        return await response.text()
      }
    } else {
      const err = await response.text()
      throw new Error(err)
    }
  }

  async create(query: { json: object }) {
    const opts = {
      method: "POST",
      body: JSON.stringify(query.json),
      headers: {
        "Content-Type": "application/json",
      },
    }
    return this.request(this.url, opts)
  }

  async read(query: { id: string, mailboxID?: string, pageLimit?: number, params: string }) {
    const url = new URL("/api/conversations", this.url);

    if (query.id) {
      url.pathname += `/${query.id}`;
    }

    if (query.mailboxID) {
      url.searchParams.set("mailboxId", query.mailboxID);
    }

    if (query.params) {
      url.search = query.params;
    }

    const opts = {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json; charset=UTF-8",
      },
    }

    // handle single conversation
    if (query.id) {
      let conversation = await this.request(url.toString(), opts);
      conversation.threads = conversation._embedded.threads;
      return conversation;
    }

    // handle multiple conversations
    const conversations: any[] = [];
    let totalPages = 1;

    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      const pageUrl = new URL(url.toString());
      pageUrl.searchParams.set("page", currentPage.toString());
      const pageData = await this.request(pageUrl.toString(), opts);

      conversations.push(...pageData._embedded.conversations);
      totalPages = pageData.page.totalPages;

      if (query.pageLimit !== undefined && query.pageLimit > 0 && currentPage >= query.pageLimit) {
        break;
      }
    }

    return conversations;
  }

  async update(query: { json: object }) {
    const opts = {
      method: "PUT",
      body: JSON.stringify(query.json),
      headers: {
        "Content-Type": "application/json",
      },
    }
    return this.request(this.url, opts)
  }

  async delete(query: { id: string }) {
    const opts = {
      method: "DELETE",
    }
    return this.request(`${this.url}/${query.id}`, opts)
  }
}

export default CustomIntegration
