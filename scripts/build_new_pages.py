"""Build diagnostic-testing.html and custom-molds.html using hearing-tests.html scaffolding."""
import re
from pathlib import Path

ROOT = Path("/home/user/workspace/aci-hearing-proof")
template = (ROOT / "hearing-tests.html").read_text()


def make_page(slug: str, title: str, meta: str, h1: str, subtitle: str, main_html: str) -> str:
    text = template
    # Title
    text = re.sub(r"<title>.*?</title>",
                  f"<title>{title}</title>", text, count=1, flags=re.S)
    # Meta description
    text = re.sub(r'<meta name="description" content=".*?">',
                  f'<meta name="description" content="{meta}">', text, count=1, flags=re.S)
    # Hero h1
    text = text.replace(
        '<h1 class="hero__title">Hearing Tests &amp; Evaluations</h1>',
        f'<h1 class="hero__title">{h1}</h1>',
        1,
    )
    # Hero subtitle
    text = text.replace(
        '<p class="hero__subtitle">Comprehensive testing to understand your hearing health.</p>',
        f'<p class="hero__subtitle">{subtitle}</p>',
        1,
    )
    # Replace main content section (everything between hero close and CTA banner)
    pattern = re.compile(
        r'(    </section>\n\n    <section class="section">\n)(.*?)(\n    <!-- CTA BANNER -->)',
        re.S,
    )
    replacement = r'\1' + main_html + r'\3'
    text = pattern.sub(replacement, text, count=1)
    return text


# === Diagnostic Testing page ===
diag_main = """      <div class="container container--default">
        <div class="content-page">
          <div class="reveal">
            <h2 class="heading-md">Advanced Diagnostic Audiology in Lafayette</h2>
            <p>A standard hearing test tells us how soft a sound you can detect. Diagnostic testing tells us <em>why</em> you hear the way you do — pinpointing the exact part of the auditory system involved, from the eardrum to the brainstem. ACI Hearing Center offers a complete suite of advanced diagnostic procedures performed by Doctors of Audiology, the same testing typically only available at major medical centers.</p>
            <p>We use these tools to evaluate infants, young children, adults who can't reliably respond to traditional testing, candidates for cochlear implants, and patients with complex or unexplained hearing concerns.</p>
          </div>

          <div class="reveal" style="margin-top: var(--space-2xl);">
            <h2 class="heading-md">What We Offer</h2>
          </div>

          <div class="grid grid--3 stagger" style="margin-top: var(--space-lg);">
            <div class="card card--service reveal">
              <div class="card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <h3 class="card__title">ABR — Auditory Brainstem Response</h3>
              <p class="card__text">Measures how the auditory nerve and brainstem respond to sound using small sensors placed on the head. Painless, non-invasive, and effective even for sleeping infants. Often used to diagnose hearing loss in newborns and rule out auditory neuropathy or retrocochlear pathology.</p>
            </div>
            <div class="card card--service reveal">
              <div class="card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
              <h3 class="card__title">ASSR — Auditory Steady-State Response</h3>
              <p class="card__text">Frequency-specific threshold estimation that builds on ABR with greater precision. Especially useful for fitting hearing aids on patients who cannot give reliable behavioral responses, including very young children and individuals with developmental disabilities.</p>
            </div>
            <div class="card card--service reveal">
              <div class="card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
              </div>
              <h3 class="card__title">DPOAE — Otoacoustic Emissions</h3>
              <p class="card__text">A fast, objective test of the inner ear's outer hair cell function. The ear actually produces tiny sounds in response to stimulation — DPOAE measures them. Excellent for screening, monitoring ototoxicity, and diagnosing the location of hearing loss.</p>
            </div>
          </div>

          <div class="highlight-box reveal" style="margin-top: var(--space-2xl);">
            <h3 class="heading-sm">Why Choose ACI for Diagnostic Testing?</h3>
            <ul>
              <li><strong>Doctors of Audiology</strong> — Every diagnostic exam is interpreted by an Au.D. clinician, not a technician.</li>
              <li><strong>All ages welcome</strong> — From newborns through seniors, our equipment and protocols accommodate every patient.</li>
              <li><strong>Coordinated care</strong> — We work directly with your ENT, primary physician, and surgical teams to share results promptly.</li>
              <li><strong>Cochlear implant candidacy</strong> — As partners with Cochlear Americas and Advanced Bionics, we routinely complete the full diagnostic workup needed for implant evaluation.</li>
              <li><strong>40+ years of experience</strong> — Acadiana's longest-running independent hearing center.</li>
            </ul>
          </div>

          <div class="reveal" style="margin-top: var(--space-2xl);">
            <h2 class="heading-md">When Is Diagnostic Testing Recommended?</h2>
            <ul>
              <li>Newborn hearing screening referral or delayed speech development</li>
              <li>Sudden hearing loss in one or both ears</li>
              <li>Hearing loss with no clear cause</li>
              <li>Dizziness, vertigo, or balance problems</li>
              <li>Tinnitus (ringing) in only one ear</li>
              <li>Cochlear implant evaluation</li>
              <li>Pre-surgical clearance or post-surgical follow-up</li>
              <li>Monitoring hearing during ototoxic medication treatment</li>
              <li>Patients who cannot complete standard behavioral hearing tests</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
"""

diag_html = make_page(
    "diagnostic-testing",
    title="Diagnostic Audiology Testing (ABR, ASSR, DPOAE) — ACI Hearing Center | Lafayette, LA",
    meta="Advanced diagnostic audiology in Lafayette, LA. ABR, ASSR, and DPOAE testing for infants, children, and adults. Cochlear implant evaluation. ACI Hearing Center — 337-223-9448.",
    h1="Advanced Diagnostic Testing",
    subtitle="ABR, ASSR, DPOAE, and the full diagnostic toolkit — performed by Doctors of Audiology.",
    main_html=diag_main,
)

(ROOT / "diagnostic-testing.html").write_text(diag_html)
print("Wrote diagnostic-testing.html")


# === Custom Molds page ===
molds_main = """      <div class="container container--default">
        <div class="content-page">
          <div class="reveal">
            <h2 class="heading-md">Custom-Crafted for Your Ears</h2>
            <p>Off-the-shelf earplugs and earbuds are made for an "average" ear that doesn't really exist. ACI Hearing Center makes custom molds — taken from a precise impression of your own ear canal — so the fit is personal, the seal is consistent, and the protection (or sound) is exactly what you need.</p>
            <p>Whether you're a musician protecting your livelihood, a hunter or shooter protecting your hearing, a swimmer keeping water out, or someone who just wants to sleep through their partner's snoring — we have a mold for that.</p>
          </div>

          <div class="reveal" style="margin-top: var(--space-2xl);">
            <h2 class="heading-md">Custom Mold Options</h2>
          </div>

          <div class="grid grid--3 stagger" style="margin-top: var(--space-lg);">
            <div class="card card--service reveal">
              <div class="card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <h3 class="card__title">Musician Molds</h3>
              <p class="card__text">Flat-attenuation filters reduce volume evenly across all frequencies — so the music still sounds like music, just safer. Ideal for performing musicians, sound engineers, conductors, and dedicated concertgoers.</p>
            </div>
            <div class="card card--service reveal">
              <div class="card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
              </div>
              <h3 class="card__title">Sleep &amp; Snore Molds</h3>
              <p class="card__text">Soft, comfortable molds that block out a snoring partner, traffic, hotel hallways — anything that disrupts sleep — while staying gentle in your ear all night long.</p>
            </div>
            <div class="card card--service reveal">
              <div class="card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <h3 class="card__title">Swim Molds</h3>
              <p class="card__text">Float-friendly waterproof molds that keep water out of the ear canal — preventing swimmer's ear, ear infections, and irritation. Essential for kids with PE tubes and for serious swimmers of any age.</p>
            </div>
            <div class="card card--service reveal">
              <div class="card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2L2 7v10l10 5 10-5V7l-10-5z"/><path d="M2 7l10 5 10-5"/><path d="M12 22V12"/></svg>
              </div>
              <h3 class="card__title">Hunter &amp; Shooter Molds</h3>
              <p class="card__text">Electronic and passive ear protection for hunters and competitive shooters. Some options amplify ambient sound while instantly blocking gunshot-level noise.</p>
            </div>
            <div class="card card--service reveal">
              <div class="card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
              </div>
              <h3 class="card__title">Custom Earbuds</h3>
              <p class="card__text">Personalized earbuds molded to your unique ear shape for exceptional comfort, superior sound quality, and a secure fit that won't slip out during workouts or commutes.</p>
            </div>
            <div class="card card--service reveal">
              <div class="card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              </div>
              <h3 class="card__title">Industrial &amp; Workplace</h3>
              <p class="card__text">Custom molds for factory workers, construction crews, first responders, and pilots. Compatible with comms headsets where required. Built to OSHA noise-reduction standards.</p>
            </div>
          </div>

          <div class="highlight-box reveal" style="margin-top: var(--space-2xl);">
            <h3 class="heading-sm">How the Custom Mold Process Works</h3>
            <ol>
              <li><strong>Consultation</strong> — Tell us how you'll use the molds. We'll recommend the best material, filter, and style.</li>
              <li><strong>Ear impressions</strong> — A safe, soft material is placed in your ear for a few minutes to capture an exact impression. Most patients find it comfortable.</li>
              <li><strong>Lab fabrication</strong> — Your impressions are sent to a specialized lab where your molds are crafted. Turnaround is typically 1–2 weeks.</li>
              <li><strong>Fitting</strong> — You return for a fit check. We make any small adjustments and show you exactly how to insert, clean, and store them.</li>
            </ol>
          </div>

          <div class="reveal" style="margin-top: var(--space-2xl);">
            <h2 class="heading-md">Why Custom Beats Off-the-Shelf</h2>
            <ul>
              <li><strong>Better seal</strong> — Custom molds match your ear's unique shape, so they don't loosen, leak, or fall out.</li>
              <li><strong>Better protection</strong> — Consistent fit means consistent attenuation. No guessing whether your earplugs are working.</li>
              <li><strong>More comfortable</strong> — Custom-fitted molds can be worn for hours without the pinching or pressure of generic plugs.</li>
              <li><strong>Longer lasting</strong> — High-quality molds typically last several years with normal care, often paying for themselves over disposable foam plugs.</li>
              <li><strong>Healthier ears</strong> — Proper fit reduces irritation, infection risk, and ear-canal trauma.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
"""

molds_html = make_page(
    "custom-molds",
    title="Custom Ear Molds & Hearing Protection — ACI Hearing Center | Lafayette, LA",
    meta="Custom ear molds in Lafayette, LA — musician molds, swim molds, sleep & snore molds, hunter/shooter protection, and custom earbuds. ACI Hearing Center — 337-223-9448.",
    h1="Custom Molds & Ear Protection",
    subtitle="Musician, swim, sleep, hunter, and workplace molds — fit precisely to your ears.",
    main_html=molds_main,
)

(ROOT / "custom-molds.html").write_text(molds_html)
print("Wrote custom-molds.html")
