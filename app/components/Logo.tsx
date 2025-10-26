import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  href?: string;         // si pasas href, el logo será un link (útil en el header)
  size?: number;         // tamaño en px del lado (cuadrado)
  showName?: boolean;    // mostrar texto a la derecha del logo
  className?: string;
};

export default function Logo({
  href = "/",
  size = 64,
  showName = true,
  className = "",
}: LogoProps) {
  const img = (
    <Image
      src="/logo.png"            // <-- coloca aquí tu logo. puede ser .svg también
      alt="Logo"
      width={size}
      height={size}
      priority
      className="h-auto w-auto object-contain drop-shadow-md"
    />
  );

  const content = (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {img}
      {showName && (
        <span className="text-xl font-semibold tracking-wide">
          Lavandería América
        </span>
      )}
    </div>
  );

  return href ? (
    <Link href={href} aria-label="Ir al inicio">
      {content}
    </Link>
  ) : (
    content
  );
}
