import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-secondary text-ash">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Image
              src="/logo.png"
              alt="PAID LLC"
              width={110}
              height={37}
              className="h-9 w-auto mb-4 brightness-0 invert"
            />
            <p className="text-stone text-sm leading-relaxed">
              AI that works. Results you can see.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold text-white text-xs uppercase tracking-widest mb-5">
              Quick Links
            </h4>
            <ul className="space-y-3">
              {[
                { href: "/", label: "Home" },
                { href: "/services", label: "Services" },
                { href: "/digital-products", label: "Digital Products" },
                { href: "/about", label: "About" },
                { href: "/contact", label: "Contact" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-stone hover:text-ash text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display font-semibold text-white text-xs uppercase tracking-widest mb-5">
              Services
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/services"
                  className="text-stone hover:text-ash text-sm transition-colors"
                >
                  AI Strategy Consulting
                </Link>
              </li>
              <li>
                <Link
                  href="/services"
                  className="text-stone hover:text-ash text-sm transition-colors"
                >
                  AI Implementation &amp; Development
                </Link>
              </li>
              <li>
                <Link
                  href="/digital-products"
                  className="text-stone hover:text-ash text-sm transition-colors"
                >
                  Digital Guides
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold text-white text-xs uppercase tracking-widest mb-5">
              Contact
            </h4>
            <p className="text-stone text-sm mb-1">
              <a
                href="mailto:hello@paiddev.com"
                className="hover:text-ash transition-colors"
              >
                hello@paiddev.com
              </a>
            </p>
            <p className="text-stone text-sm mb-6">
              We respond within 1 business day.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                aria-label="LinkedIn"
                className="text-stone hover:text-ash transition-colors text-sm"
              >
                LinkedIn
              </a>
              <span className="text-charcoal">·</span>
              <a
                href="#"
                aria-label="X / Twitter"
                className="text-stone hover:text-ash transition-colors text-sm"
              >
                X
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-charcoal pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-stone text-xs">
            © {new Date().getFullYear()} PAID LLC. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="text-stone hover:text-ash text-xs transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-stone hover:text-ash text-xs transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
