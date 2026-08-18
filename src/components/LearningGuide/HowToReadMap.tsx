import type { LearnMapPage } from "../../content/learnMap";

export const HowToReadMap = ({ page }: { page: LearnMapPage }): JSX.Element => (
  <article className="how-to-read-map" aria-labelledby={`learn-map-${page.id}`}>
    <p className="how-to-read-map__eyebrow">{page.eyebrow}</p>
    <h2 id={`learn-map-${page.id}`}>{page.title}</h2>
    <p className="how-to-read-map__intro">{page.introduction}</p>
    <figure className="how-to-read-map__diagram" aria-label={page.diagramAlt}>
      <div className="how-to-read-map__cards">
        {page.cards.map((card, index) => (
          <div
            key={`${card.label}-${index}`}
            className={`how-to-read-map__card how-to-read-map__card--${card.tone}`}
          >
            <strong>{card.label}</strong>
            <span>{card.detail}</span>
            {page.connector && index < page.cards.length - 1 ? (
              <i aria-hidden="true">
                <b>{page.connector}</b>
                <span>↓</span>
              </i>
            ) : null}
          </div>
        ))}
      </div>
      <figcaption>{page.note}</figcaption>
    </figure>
  </article>
);
