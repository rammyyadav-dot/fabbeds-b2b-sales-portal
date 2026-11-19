# UAEWB Homepage Production Blueprint

## Product boundary

UAEWB is a UAE-only B2B travel marketplace. Public marketplace inventory must be limited to the seven UAE emirates and all displayed sell pricing must be AED. No public component may infer, fabricate, or convert a non-AED rate.

## Homepage component architecture

```
HomepageLayoutContainer
├── NavigationBarComponent
│   ├── UAEWB identity
│   ├── AED fixed marketplace currency
│   ├── UAE marketplace scope
│   ├── partner authentication state
│   ├── agency credit summary
│   └── Hotels / Attractions / Transfers / Visa / Packages
├── HeroSearchWidget
│   ├── destination/hotel resolution from UAE hotel master
│   ├── stay dates
│   ├── room occupancy
│   ├── child ages
│   ├── validation
│   └── URL-backed search state
├── ContentVarietyEngine
│   ├── deterministic promotional campaign selection
│   ├── no pricing mutation
│   └── routes into existing product workflows
├── RecentSearches
│   └── local user convenience state only
├── DynamicDealBanner
│   └── campaign configuration from homeContent.ts
├── UAE Destination Carousel
│   └── seven emirates only
├── UAE Product Carousel
│   └── hotels / attractions / transfers / visa / packages
├── Live Hotel Deals Carousel
│   ├── backend hotel master
│   ├── exact room + rate plan
│   ├── positive complete-stay pricing
│   ├── AED-only sell currency
│   ├── cancellation proof badge
│   ├── free-sale proof badge
│   └── optional structured guest rating aggregate
├── UAE Experience Planner
├── Trade Service CTAs
│   ├── price match
│   ├── offline hotel sourcing
│   └── groups & MICE
├── Agency Credit CTA
└── UAEFooterDirectory
    └── UAE-focused SEO navigation
```

## Travel-agent proof logic engine

Hotel proof data must be structured and backend-derived.

### Hotel master proof fields
- Guest Rating: decimal aggregate score.
- Review Count: integer aggregate count.
- Review Label: controlled value such as Exceptional, Superb, Excellent, Very good, Good.

The UI must not display a rating block unless Guest Rating is positive and Review Count is positive.

### Rate-plan proof fields
Cancellation badges are derived from the linked Rate Plan:
- Refundable = false -> Non-refundable.
- Refundable = true with cancellation window -> Free cancellation until calculated deadline.
- Refundable = true with no positive window -> Free cancellation.

Availability badges are derived from effective Daily Rate status, not campaign content.

## Commercial pricing invariants

1. Public hotel scope is UAE emirates only.
2. Active public Rate Plans must have Sell Currency = AED or legacy null interpreted as AED-only inventory pending cleanup.
3. Zero, partial, invalid, Stop Sale, quarantined or missing rates cannot become a monetary deal.
4. Markup cannot create a price from zero.
5. Live deal cards use complete-stay positive sell totals only.
6. Marketing campaigns cannot alter or override rate data.
7. Guest review aggregates are optional and must not be invented.
8. Search and detail booking continue to pass authoritative Hotel ID + Room Type ID + Rate Plan ID.

## Content Variety Engine rules

The content engine may vary:
- campaign headline
- supporting copy
- CTA destination
- visual accent
- featured UAE theme

It may not vary:
- hotel price
- cancellation policy
- availability
- review score/count
- room/rate mapping
- credit availability

## SEO / discovery scope

Footer navigation should target UAE-only discovery intent:
- Dubai hotels
- Abu Dhabi hotels
- Ras Al Khaimah hotels
- Sharjah hotels
- Fujairah hotels
- Ajman hotels
- Umm Al Quwain hotels
- UAE attractions
- UAE transfers
- UAE visa services
- UAE packages
- groups & MICE
- offline UAE hotel sourcing

## Performance expectations

- carousels use horizontal overflow and browser-native lazy image loading
- destination imagery reuses already loaded hotel imagery where available
- the homepage uses one pricing API request for featured dates
- no duplicate hotel pricing engine is introduced
- search page remains the authoritative second-step results experience
