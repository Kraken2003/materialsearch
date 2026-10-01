import SearchWorkspace from '@/components/SearchWorkspace';
export default function Page() {
 const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
 const contactEmail = email && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email) ? email : undefined;
 return <SearchWorkspace contactEmail={contactEmail}/>;
}
