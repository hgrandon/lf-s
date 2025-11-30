// app/servicio/[nro]/page.tsx
import { redirect } from 'next/navigation';

type PageProps = {
  params: { nro: string };
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function ServicioNroRedirectPage({ params, searchParams }: PageProps) {
  const nro = params.nro;

  // armamos los query params conservando popup si viene
  const qs = new URLSearchParams();
  if (nro) qs.set('nro', nro);

  const popupParam = searchParams?.popup;
  const popupValue = Array.isArray(popupParam) ? popupParam[0] : popupParam;
  if (popupValue) {
    qs.set('popup', popupValue);
  }

  redirect(`/servicio?${qs.toString()}`);
}
