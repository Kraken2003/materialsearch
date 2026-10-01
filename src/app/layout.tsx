import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Material Atlas | Search by elements',description:'Discover matching materials across open databases and explore related research, starting with the periodic table.'};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="en"><body>{children}</body></html>;
}
