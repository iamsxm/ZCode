import { GitHubProvider } from "electron-updater/out/providers/GitHubProvider.js";
import type { GithubOptions, CancellationToken } from "builder-util-runtime";
import type { AppUpdater, ResolvedUpdateFileInfo } from "electron-updater";
import type { ProviderRuntimeOptions } from "electron-updater/out/providers/Provider.js";
import { logger } from "./logger.js";

export const GH_PROXY_BASE = "https://gh-proxy.com/";

/**
 * 将 GitHub URL 包装为 gh-proxy.com 代理加速链接
 */
export function toGhProxyUrl(rawUrl: URL | string): URL {
  const urlStr = typeof rawUrl === "string" ? rawUrl : rawUrl.href;
  if (urlStr.startsWith(GH_PROXY_BASE)) {
    return new URL(urlStr);
  }
  return new URL(`${GH_PROXY_BASE}${urlStr}`);
}

export interface AcceleratedGitHubOptions extends GithubOptions {
  enableGhProxyFallback?: boolean;
}

/**
 * 具备国内网络加速与自动重试的 GitHub Release 更新提供方：
 * 1. 优先尝试直连官方 GitHub 接口与 Release 资源；
 * 2. 直连失败（超时/连接重置/网络不可达）时，自动无缝切换至 gh-proxy.com 代理进行重试；
 * 3. 获取更新清单或下载安装包时均支持该重试机制。
 */
export class AcceleratedGitHubProvider extends GitHubProvider {
  private useProxy = false;
  private readonly enableProxyFallback: boolean;

  constructor(
    options: AcceleratedGitHubOptions,
    updater: AppUpdater,
    runtimeOptions: ProviderRuntimeOptions,
  ) {
    super(options, updater, runtimeOptions);
    this.enableProxyFallback = options.enableGhProxyFallback !== false;
  }

  override createRequestOptions(url: URL, headers?: any) {
    const targetUrl = this.useProxy && this.enableProxyFallback ? toGhProxyUrl(url) : url;
    return super.createRequestOptions(targetUrl, headers);
  }

  override async httpRequest(
    url: URL,
    headers?: Record<string, string>,
    cancellationToken?: CancellationToken,
  ): Promise<string | null> {
    if (this.useProxy && this.enableProxyFallback) {
      const proxyUrl = toGhProxyUrl(url);
      return super.httpRequest(proxyUrl, headers, cancellationToken);
    }

    try {
      return await super.httpRequest(url, headers, cancellationToken);
    } catch (directError) {
      if (!this.enableProxyFallback) {
        throw directError;
      }
      logger.warn(
        `[auto-update] GitHub 直连请求失败 (${url.href})，尝试使用 ${GH_PROXY_BASE} 代理重试:`,
        directError,
      );
      this.useProxy = true;
      const proxyUrl = toGhProxyUrl(url);
      return super.httpRequest(proxyUrl, headers, cancellationToken);
    }
  }

  override async getLatestVersion(): Promise<any> {
    try {
      return await super.getLatestVersion();
    } catch (error) {
      if (this.useProxy || !this.enableProxyFallback) {
        throw error;
      }
      logger.warn(
        `[auto-update] 获取 GitHub 最新版本失败，切换至 ${GH_PROXY_BASE} 代理重试:`,
        error,
      );
      this.useProxy = true;
      return await super.getLatestVersion();
    }
  }

  override resolveFiles(updateInfo: any): Array<ResolvedUpdateFileInfo> {
    const files = super.resolveFiles(updateInfo);
    if (!this.useProxy || !this.enableProxyFallback) {
      return files;
    }

    // 代理模式下，将各平台安装包下载链接转换为 gh-proxy 代理下载地址
    return files.map((file) => ({
      ...file,
      url: toGhProxyUrl(file.url),
    }));
  }
}
