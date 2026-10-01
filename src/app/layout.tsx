import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Material Atlas | Search by elements',description:'Search material databases by chemical elements. View crystal structures, material properties, source references, and related papers.',icons:{icon:{url:'/brand-mark.svg',type:'image/svg+xml'},shortcut:'/brand-mark.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="en"><body>{children}</body></html>;
}
