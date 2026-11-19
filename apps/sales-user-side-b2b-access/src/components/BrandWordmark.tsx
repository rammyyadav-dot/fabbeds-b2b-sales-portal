type BrandWordmarkProps = {
 tone?: 'light' | 'dark';
 size?: 'sm' | 'md' | 'lg';
 className?: string;
};
const SIZE_CLASSES={sm:'w-24',md:'w-32 sm:w-36',lg:'w-48'} as const;
export default function BrandWordmark({size='md',className=''}:BrandWordmarkProps){
 return <img src="/fabbeds-logo.svg" alt="fabBeds" width={3464} height={1154} className={`inline-block h-auto object-contain shrink-0 ${SIZE_CLASSES[size]} ${className}`} />;
}
