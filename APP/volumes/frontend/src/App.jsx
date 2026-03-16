function App() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(96,232,255,0.20),_transparent_32%),linear-gradient(180deg,_#0a1620_0%,_#09131b_45%,_#050b10_100%)] px-6 py-10 text-mist">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center">
        <div className="w-full rounded-[28px] border border-cyan/20 bg-ink/70 p-8 shadow-panel backdrop-blur md:p-12">
          <p className="mb-4 inline-flex rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan">
            React + Tailwind
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
            iTop Hub frontend listo para construir la integracion.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-mist/80 md:text-lg">
            Este contenedor ya responde con React y Tailwind en caliente para que
            podamos avanzar sobre vistas, formularios, flujos de actas y la capa
            de integracion del Hub.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-slate/70 p-5">
              <p className="text-sm uppercase tracking-[0.22em] text-cyan/80">
                Acceso principal
              </p>
              <p className="mt-3 text-lg font-medium text-white">
                <a className="transition hover:text-cyan" href="/">
                  localhost
                </a>
              </p>
              <p className="mt-2 text-sm text-mist/70">
                Nginx apunta por defecto a iTop y unifica la entrada del stack.
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-slate/70 p-5">
              <p className="text-sm uppercase tracking-[0.22em] text-cyan/80">
                Hub
              </p>
              <p className="mt-3 text-lg font-medium text-white">
                <a className="transition hover:text-cyan" href="/itop-hub">
                  localhost/itop-hub
                </a>
              </p>
              <p className="mt-2 text-sm text-mist/70">
                Ruta pensada para convivir con iTop sin tocar su core ni schemas.
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-slate/70 p-5">
              <p className="text-sm uppercase tracking-[0.22em] text-cyan/80">
                API
              </p>
              <p className="mt-3 text-lg font-medium text-white">
                <a className="transition hover:text-cyan" href="/api">
                  localhost/api
                </a>
              </p>
              <p className="mt-2 text-sm text-mist/70">
                FastAPI queda preparada para documentacion y consumo via reverse proxy.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
