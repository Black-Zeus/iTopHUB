export function SidebarBrand({ collapsed, brand = {} }) {
  const logoUrl = `${brand?.organizationLogoUrl || ""}`.trim();
  const orgName = `${brand?.organizationName || "iTop Hub"}`.trim();
  const orgAcronym = `${brand?.organizationAcronym || "IH"}`.trim();

  return (
    <div className={`relative flex min-h-[72px] items-start gap-3 ${collapsed ? "justify-center" : ""}`}>
      <div
        className={`flex min-w-0 flex-1 items-start gap-4 overflow-hidden bg-transparent text-left ${
          collapsed ? "flex-none justify-center" : ""
        }`}
        aria-hidden="true"
      >
        <div className={`relative z-[1] mt-[0.1rem] grid place-items-center overflow-hidden rounded-[18px] border border-white/20 shadow-[0_10px_24px_rgba(58,121,164,0.26)] before:pointer-events-none before:absolute before:left-1/2 before:top-1/2 before:z-[-1] before:h-16 before:w-16 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-[8deg] before:rounded-[21px] before:border before:border-[rgba(120,182,217,0.2)] before:content-[''] ${collapsed ? "h-[50px] w-[50px]" : "h-[48px] w-[48px]"} ${logoUrl ? "bg-white/95 p-1.5" : "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.38),transparent_44%),linear-gradient(180deg,#b5dbf4_0%,#7bb4d9_100%)] font-extrabold text-white text-[1.3rem]"}`}>
          {logoUrl ? (
            <img src={logoUrl} alt={orgName} className="max-h-full max-w-full object-contain" />
          ) : (
            orgAcronym
          )}
        </div>
        <div
          className="grid min-w-0 gap-1 overflow-hidden pt-1 transition-[opacity,transform,width,margin,height] duration-[220ms] ease-in-out"
          style={collapsed ? { opacity: 0, transform: "translateX(-10px)", width: 0, pointerEvents: "none" } : undefined}
        >
          <p className="text-[0.76rem] font-medium uppercase tracking-[0.16em] leading-none text-[#79aed3]">
            Gestion TI
          </p>
          <h1 className="max-w-full text-[1.15rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#f4f8fb]">
            {orgName}
          </h1>
        </div>
      </div>
    </div>
  );
}
