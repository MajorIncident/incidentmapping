import { getBuildInfo } from "../../lib/buildInfo";

export const Footer = (): JSX.Element => {
  const currentYear = new Date().getFullYear();
  const { version, commit, builtAtFormatted } = getBuildInfo();

  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-4 text-sm text-slate-600">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span>© {currentYear} Kepner-Tregoe. All rights reserved.</span>
          <span className="text-slate-400">•</span>
          <a
            className="text-blue-700 underline hover:text-blue-900"
            href="#privacy"
            aria-label="Privacy Policy"
          >
            Privacy Policy
          </a>
          <span className="text-slate-400">•</span>
          <a
            className="text-blue-700 underline hover:text-blue-900"
            href="#eula"
            aria-label="EULA"
          >
            EULA
          </a>
          <span className="text-slate-400">•</span>
          <span>
            Crafted by{" "}
            <a
              className="text-blue-700 underline hover:text-blue-900"
              href="https://www.linkedin.com/in/shanechagpar/"
              target="_blank"
              rel="noreferrer"
            >
              Shane Chagpar
            </a>
            .
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-slate-500">
          <span>Version {version}</span>
          <span className="text-slate-300">•</span>
          <span>Build {commit}</span>
          {builtAtFormatted ? (
            <>
              <span className="text-slate-300">•</span>
              <span>Built {builtAtFormatted}</span>
            </>
          ) : null}
        </div>
      </div>
    </footer>
  );
};
