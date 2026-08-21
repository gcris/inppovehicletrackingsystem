import { Shield, Mail, Phone, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { FaFacebookSquare, FaGithub } from "react-icons/fa";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-slate-950 text-slate-300">
      {/* Background Decoration */}

      <div className="absolute inset-0">
        <div className="absolute -left-40 top-0 h-80 w-80 rounded-full bg-blue-700/10 blur-3xl" />

        <div className="absolute -right-40 bottom-0 h-80 w-80 rounded-full bg-cyan-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-4">
          {/* System */}

          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-white p-0.5">
                <img
                  src="/assets/mobilis-logo.png"
                  alt="Project M.O.B.I.L.I.S"
                  className="h-12 w-12 object-contain"
                />
              </div>

              <div>
                <p className="text-xl font-black text-white">
                  Project M.O.B.I.L.I.S
                </p>
              </div>
            </div>

            <p className="leading-8 text-slate-400">
              Mobility Operations-Based Information and Logistics Inspection
              System (MOBILIS) for centralized mobility asset management,
              inspections, maintenance monitoring, and operational reporting.
            </p>
          </div>

          {/* Modules */}

          <div>
            <h4 className="mb-5 font-bold text-white">Modules</h4>

            <ul className="space-y-3 text-slate-400">
              <li>Mobility Assets</li>

              <li>Maintenance History</li>

              <li>Mobility Inspection</li>

              <li>Analytics & Reports</li>
            </ul>
          </div>

          {/* Contact */}

          <div>
            <h4 className="mb-5 font-bold text-white">Contact</h4>

            <div className="space-y-4">
              <div className="flex gap-3">
                <Link
                  to="https://maps.google.com/?cid=17984942782073576459"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex cursor-pointer gap-3 text-slate-200 transition-colors hover:text-blue-400"
                >
                  <MapPin className="mt-1 h-5 w-5 shrink-0 text-blue-400 transition-transform group-hover:scale-110" />
                  <span className="group-hover:underline">
                    Ilocos Norte Police Provincial Office
                  </span>
                </Link>
              </div>

              <div className="flex gap-3">
                <Link
                  to="tel:+639981770471"
                  className="group flex items-center gap-3 transition-colors hover:text-blue-400 cursor-pointer"
                >
                  <Phone className="h-5 w-5 shrink-0 text-blue-400 transition-transform group-hover:scale-110" />
                  <span className="group-hover:underline">
                    +63 998 177 0471
                  </span>
                </Link>
              </div>

              <div className="flex gap-3">
                <Link
                  to="mailto:operations_inppo@yahoo.com"
                  className="group flex items-center gap-3 transition-colors hover:text-blue-400 cursor-pointer"
                >
                  <Mail className="h-5 w-5 shrink-0 text-blue-400 transition-transform group-hover:scale-110" />
                  <span className="group-hover:underline">
                    operation_inppo@yahoo.com
                  </span>
                </Link>
              </div>
            </div>
          </div>

          {/* Developer */}

          <div>
            <h4 className="mb-5 font-bold text-white">Development</h4>

            <p className="leading-8 text-slate-400">
              Developed to support digital transformation initiatives of the
              Ilocos Norte Police Provincial Office through centralized mobilty
              management system.
            </p>

            <div className="mt-6 flex gap-4">
              <Link
                to="https://github.com/gcris/inppovehicletrackingsystem"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-slate-700 p-3 transition hover:border-blue-500 hover:bg-slate-800"
              >
                <FaGithub className="h-5 w-5" />
              </Link>
              <Link
                to="https://www.facebook.com/pomu.inppo"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-slate-700 p-3 transition hover:bg-blue-700 hover:border-blue-500 transition"
              >
                <FaFacebookSquare className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Divider */}

        <div className="my-12 h-px bg-slate-800" />

        {/* Bottom */}

        <div className="flex flex-col items-center justify-between gap-5 text-sm text-slate-500 md:flex-row">
          <p>
            © {year} MOBILIS — Mobility Operations, Maintenance, & Inspection
            Logistics Information System.
          </p>

          <div className="flex gap-8">
            <span>Philippine National Police</span>

            <span>Ilocos Norte Police Provincial Office</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
