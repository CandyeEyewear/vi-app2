// Create: /api/ezee/webhook-manual-test.ts
export default async function handler(req: any, res: any) {
    console.log('Manual webhook test called!');
    console.log('Method:', req.method);
    console.log('Body:', req.body);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Manual test received',
      timestamp: new Date().toISOString()
    });
  }