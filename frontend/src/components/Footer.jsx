import React from "react";

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-center font-mono text-[11px] text-ink-faint">
          &copy; {new Date().getFullYear()} ACME Industries Ltd &mdash; files are processed and discarded, never stored.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
