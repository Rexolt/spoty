export const GITHUB_REPO = "Rexolt/spoty";

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export const getDownloadLinks = (version: string) => {
  const v = version.startsWith('v') ? version.slice(1) : version;
  const baseUrl = `https://github.com/${GITHUB_REPO}/releases/download/v${v}`;

  return {
    windows: [
      { name: "Setup (x64)", url: `${baseUrl}/Spoty-Setup-${v}-x64.exe` },
      { name: "Setup (ARM64)", url: `${baseUrl}/Spoty-Setup-${v}-arm64.exe` },
      { name: "Portable (x64)", url: `${baseUrl}/Spoty-Portable-${v}-x64.exe` },
      { name: "Portable (ARM64)", url: `${baseUrl}/Spoty-Portable-${v}-arm64.exe` },
    ],
    macos: [
      { name: "Universal DMG", url: `${baseUrl}/Spoty-${v}-universal.dmg` },
      { name: "Universal ZIP", url: `${baseUrl}/Spoty-${v}-universal.zip` },
    ],
    linux: [
      { name: "AppImage (x86_64)", url: `${baseUrl}/Spoty-${v}-x86_64.AppImage` },
      { name: "AppImage (ARM64)", url: `${baseUrl}/Spoty-${v}-arm64.AppImage` },
      { name: "Debian (amd64)", url: `${baseUrl}/Spoty-${v}-amd64.deb` },
      { name: "Debian (arm64)", url: `${baseUrl}/Spoty-${v}-arm64.deb` },
      { name: "Fedora (x86_64)", url: `${baseUrl}/Spoty-${v}-x86_64.rpm` },
      { name: "Fedora (aarch64)", url: `${baseUrl}/Spoty-${v}-aarch64.rpm` },
      { name: "Arch (x64)", url: `${baseUrl}/Spoty-${v}-x64.pacman` },
      { name: "Arch (aarch64)", url: `${baseUrl}/Spoty-${v}-aarch64.pacman` },
    ]
  };
};
