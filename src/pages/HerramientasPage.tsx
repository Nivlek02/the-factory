import Layout from '@/components/layout/Layout';
import BitlyLinkTool from '@/components/tools/BitlyLinkTool';

const HerramientasPage = () => {
  return (
    <Layout>
      <div className="flex h-full flex-col p-6">
        <div className="mb-4 shrink-0">
          <h1 className="text-2xl font-bold text-foreground">Herramientas</h1>
        </div>
        <div className="min-h-0 flex-1">
          <BitlyLinkTool />
        </div>
      </div>
    </Layout>
  );
};

export default HerramientasPage;
