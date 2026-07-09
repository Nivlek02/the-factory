import Layout from '@/components/layout/Layout';
import BitlyLinkTool from '@/components/tools/BitlyLinkTool';

const HerramientasPage = () => {
  return (
    <Layout>
      <div className="p-6 h-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Herramientas</h1>
          <p className="text-muted-foreground">Crear código QR con métricas de seguimiento</p>
        </div>
        <div className="rounded-lg border shadow-sm overflow-y-auto" style={{ height: 'calc(100vh - 160px)' }}>
          <BitlyLinkTool />
        </div>
      </div>
    </Layout>
  );
};

export default HerramientasPage;
