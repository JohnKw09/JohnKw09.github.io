# MyDay

Responsywny planer dnia zbudowany w React, TypeScript, Vite, Tailwind CSS i Lucide React. Dane zadań, wydarzeń, ustawień, notatek oraz sesji skupienia są zapisywane w `localStorage` przeglądarki.

## Uruchomienie

Wymagany jest Node.js 20.19+ (lub 22.12+) oraz pnpm albo npm.

```bash
pnpm install
pnpm dev
```

Otwórz adres wyświetlony przez Vite. Możesz też użyć `npm install`, `npm run dev`, `npm run build` i `npm run preview`.

## Struktura

- `App.tsx` — widoki, komponenty oraz obsługa interakcji
- `storage.ts` — inicjalizacja, migracja i zapis danych w przeglądarce
- `types.ts` — współdzielone typy aplikacji
- `styles.css` — style, responsywność i motyw jasny/ciemny
- `vite.config.ts` — konfiguracja Vite, React i Tailwind CSS

Pierwszy start tworzy przykładowe zadania. Istniejące dane zapisane pod kluczem `myday-v1` pozostają dostępne.
