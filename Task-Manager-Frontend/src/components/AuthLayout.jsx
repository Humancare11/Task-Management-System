import loginImg from "../Assets/images/login-img.svg";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen w-full  flex items-center justify-center bg-white px-6 py-16">
      <div className="w-full max-w-7xl grid md:grid-cols-2 gap-28 items-center">
        {/* Left: brand + illustration */}
        <div className="hidden md:flex flex-col items-center text-center gap-6">
          <div className="w-14 h-14 rounded-xl border-2 border-black flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="black"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>

          <h1 className="text-3xl font-semibold text-black leading-snug">
            Humancare Connect Makes
            <br />
            Task Management Better
          </h1>

          {/* Replace this src with your own illustration */}
          <img
            src={loginImg}
            alt="Illustration"
            className="w-full max-w-md rounded-lg"
          />
        </div>

        {/* Right: form card */}
        <div className="w-full bg-zinc-800 rounded-2xl px-8 py-10 sm:px-12 sm:py-12">
          <h2 className="text-3xl font-semibold text-white text-center mb-2">
            {title}
          </h2>
          {subtitle && (
            <p className="text-center text-white/60 text-sm mb-8">{subtitle}</p>
          )}

          {children}

          {footer && (
            <p className="text-center text-white/60 text-sm mt-6">{footer}</p>
          )}
        </div>
      </div>
    </div>
  );
}
