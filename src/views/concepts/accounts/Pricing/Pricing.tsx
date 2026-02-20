import Card from '@/components/ui/Card'
import Plans from './components/Plans'
import PaymentCycleToggle from './components/PaymentCycleToggle'
import Faq from './components/Faq'
import PaymentDialog from './components/PaymentDialog'
import Integrations from './components/Integrations'

const Pricing = () => {
    return (
        <>
            {/* <Card className="mb-4">
                <div className="flex items-center justify-between mb-8">
                    <h3>Pricing</h3>
                    <PaymentCycleToggle />
                </div>
                <Plans />
            </Card> */}
            <Integrations />
           {/*  <Faq />
            <PaymentDialog /> */}
        </>
    )
}

export default Pricing
