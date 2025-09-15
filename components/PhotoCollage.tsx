"use client";
import React from "react";

/**
 * Accepts either explicit photo URLs (dest.photos) or falls back
 * to a small, curated set of safe images per known demo slug.
 */
const FALLBACKS: Record<string, string[]> = {
  lisbon: [
    "https://upload.wikimedia.org/wikipedia/commons/2/2e/Lisbon_Tram_28.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/3/34/Lisbon_Pra%C3%A7a_do_Com%C3%A9rcio.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/5/54/Torre_de_Bel%C3%A9m_-_Lisbon%2C_Portugal_%28cropped%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/a/a3/Sintra_-_Pena_Palace.jpg",
  ],
  "mexico-city": [
    "https://upload.wikimedia.org/wikipedia/commons/7/7f/Mexico_City_zocalo_cathedral.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/5/53/Chapultepec_Castle_2015.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/0/0a/Palacio_de_Bellas_Artes%2C_M%C3%A9xico.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/2/2c/Frida_Kahlo_Museum_Casa_Azul.jpg",
  ],
  montreal: [
    "https://upload.wikimedia.org/wikipedia/commons/3/3d/Old_Montreal.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/3/3e/Montreal_Biodome.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/e/ea/Montreal_Skyline.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/f/f1/Notre-Dame_Basilica_Montreal.jpg",
  ],
  "san-diego": [
    "https://upload.wikimedia.org/wikipedia/commons/2/25/San_Diego_Skyline_Day.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/6/6d/San_Diego_Zoo_entrance.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/1/1e/La_Jolla_Cove.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/0/07/Balboa_Park_2013.jpg",
  ],
  honolulu: [
    "https://upload.wikimedia.org/wikipedia/commons/0/0a/Waikiki_Beach_-_Honolulu.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/1/1b/Diamond_Head%2C_Honolulu.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/0/0f/Hanauma_Bay.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/7/7b/Iolani_Palace_Honolulu.JPG",
  ],
};

export default function PhotoCollage({
  slug,
  photos,
}: {
  slug: string;
  photos?: string[];
}) {
  const imgs: string[] =
    Array.isArray(photos) && photos.length >= 4 ? photos.slice(0, 4) : FALLBACKS[slug] ?? [];

  if (imgs.length === 0) {
    return <div className="text-sm text-neutral-500">Photos not available.</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {imgs.map((src, i) => (
        <div
          key={i}
          className="aspect-[4/3] overflow-hidden rounded-xl border bg-white/60"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.03]"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}
