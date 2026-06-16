import Layout from '@/components/layout/Layout';

const HerramientasPage = () => {
  return (
    <Layout>
      <div className="p-6 h-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Herramientas</h1>
          <p className="text-muted-foreground">Bitly, QR y Links</p>
        </div>
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
          <iframe
            src="https://n8n.camarabaq.org.co/webhook/bitly+qr+links"
            className="w-full h-full border-0"
            title="Herramientas"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </Layout>
  );
};

export default HerramientasPage;
