// app/menu/page.tsx  (SERVER COMPONENT)
import type { Metadata } from 'next';
import MenuClient from './MenuClient';

export const metadata: Metadata = {
  title: 'Menú',
};

export default function MenuPage() {
  return <MenuClient />;
}



