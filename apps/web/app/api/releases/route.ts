import { NextResponse } from 'next/server';

const GITHUB_REPO = 'LinXueyuanStdio/viben';
const CACHE_TTL = 5 * 60; // 5 minutes in seconds

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  prerelease: boolean;
  published_at: string;
  assets?: GitHubAsset[];
}

interface UnifiedRelease {
  version: string;
  tag: string;
  date: string;
  repository: string;
  components: {
    cli: boolean;
    desktop: boolean;
  };
  cli: {
    install_methods: {
      shell: { command: string; platforms: string[] };
      npx: { command: string; platforms: string[] };
      npm: { command: string; platforms: string[] };
      homebrew: { command: string; platforms: string[] };
    };
    assets: {
      install_sh: { url: string; name: string };
    };
  };
  desktop: {
    assets: {
      macos: {
        arm64: { url: string; name: string };
        x64: { url: string; name: string };
      };
      windows: {
        msi: { url: string; name: string };
        exe: { url: string; name: string };
      };
      linux: {
        appimage?: { url: string; name: string };
        deb: { url: string; name: string };
      };
    };
  };
  links: {
    npm: string;
    documentation: string;
    changelog: string;
  };
}

/**
 * Construct unified release data from GitHub release assets
 */
function constructUnifiedData(release: GitHubRelease): UnifiedRelease {
  const version = release.tag_name.replace(/^v/, '');
  const assets = release.assets || [];

  const dmgArm64 = assets.find(a => a.name.endsWith('.dmg') && a.name.includes('aarch64'));
  const dmgX64 = assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('x86_64') || a.name.includes('x64')));
  const msi = assets.find(a => a.name.endsWith('.msi'));
  const exe = assets.find(a => a.name.endsWith('-setup.exe'));
  const appimage = assets.find(a => a.name.endsWith('.AppImage'));
  const deb = assets.find(a => a.name.endsWith('.deb'));
  const installSh = assets.find(a => a.name === 'install.sh');

  return {
    version,
    tag: release.tag_name,
    date: release.published_at,
    repository: GITHUB_REPO,
    components: {
      cli: !!installSh,
      desktop: !!(dmgArm64 || dmgX64 || msi || exe || appimage || deb),
    },
    cli: {
      install_methods: {
        shell: {
          command: `curl -fsSL https://github.com/${GITHUB_REPO}/releases/latest/download/install.sh | bash`,
          platforms: ['macos', 'linux'],
        },
        npx: {
          command: 'npx viben',
          platforms: ['macos', 'linux', 'windows'],
        },
        npm: {
          command: 'npm install -g viben',
          platforms: ['macos', 'linux', 'windows'],
        },
        homebrew: {
          command: `brew tap ${GITHUB_REPO.split('/')[0]}/viben && brew install viben`,
          platforms: ['macos', 'linux'],
        },
      },
      assets: {
        install_sh: {
          url: installSh?.browser_download_url || `https://github.com/${GITHUB_REPO}/releases/download/${release.tag_name}/install.sh`,
          name: 'install.sh',
        },
      },
    },
    desktop: {
      assets: {
        macos: {
          arm64: { url: dmgArm64?.browser_download_url || '', name: dmgArm64?.name || '' },
          x64: { url: dmgX64?.browser_download_url || '', name: dmgX64?.name || '' },
        },
        windows: {
          msi: { url: msi?.browser_download_url || '', name: msi?.name || '' },
          exe: { url: exe?.browser_download_url || '', name: exe?.name || '' },
        },
        linux: {
          ...(appimage && { appimage: { url: appimage.browser_download_url, name: appimage.name } }),
          deb: { url: deb?.browser_download_url || '', name: deb?.name || '' },
        },
      },
    },
    links: {
      npm: 'https://www.npmjs.com/package/viben',
      documentation: `https://github.com/${GITHUB_REPO}`,
      changelog: `https://github.com/${GITHUB_REPO}/blob/main/CHANGELOG.md`,
    },
  };
}

/** @ignore */
export async function GET() {
  try {
    const releasesUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
    const response = await fetch(releasesUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        // Use GitHub token if available for higher rate limits
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        }),
      },
      next: { revalidate: CACHE_TTL },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch releases from GitHub' },
        { status: response.status }
      );
    }

    const releases: GitHubRelease[] = await response.json();

    // Find the latest non-prerelease with 'v' prefix
    const release = releases.find(r => r.tag_name.startsWith('v') && !r.prerelease);
    if (!release) {
      return NextResponse.json(
        { error: 'No release found' },
        { status: 404 }
      );
    }

    // Try to fetch releases.json from release assets first
    const jsonAsset = release.assets?.find(a => a.name === 'releases.json');
    if (jsonAsset) {
      const jsonResponse = await fetch(jsonAsset.browser_download_url);
      if (jsonResponse.ok) {
        const data = await jsonResponse.json();
        return NextResponse.json(data, {
          headers: {
            'Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=${CACHE_TTL * 2}`,
          },
        });
      }
    }

    // Fallback: construct data from release assets
    const data = constructUnifiedData(release);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=${CACHE_TTL * 2}`,
      },
    });
  } catch (error) {
    console.error('Failed to fetch releases:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
