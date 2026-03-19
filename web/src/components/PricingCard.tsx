"use client";

import Link from "next/link";

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  ctaHref: string;
}

export default function PricingCard({
  name,
  price,
  period = "/mo",
  description,
  features,
  highlighted = false,
  cta,
  ctaHref,
}: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 ${
        highlighted
          ? "border-primary-600 bg-white shadow-lg shadow-primary-100 ring-1 ring-primary-600"
          : "border-slate-200 bg-white"
      }`}
    >
      {highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-4 py-1 text-xs font-semibold text-white">
          Most Popular
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold text-slate-900">{price}</span>
        {price !== "Free" && price !== "Custom" && (
          <span className="text-sm text-slate-500">{period}</span>
        )}
      </div>

      <ul className="mb-8 flex-1 space-y-3">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={`w-full text-center ${
          highlighted ? "btn-primary" : "btn-secondary"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
