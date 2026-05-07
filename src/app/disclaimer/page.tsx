export const metadata = {
    title: "면책사항",
    description: "보험계산기.kr 면책사항 안내",
};

export default function DisclaimerPage() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-12">
            <h1 className="mb-6 text-3xl font-bold">면책사항</h1>

            <div className="space-y-4 text-gray-700 leading-7">
                <p>
                    보험계산기.kr에서 제공하는 계산 결과는 참고용 정보입니다.
                </p>

                <p>
                    실제 보험료, 자기부담금, 보장 범위 및 보험금 지급 여부는
                    보험사 상품 약관, 가입 시기, 특약, 병원 청구 항목 등에 따라
                    달라질 수 있습니다.
                </p>

                <p>
                    본 사이트는 특정 보험사의 상품 가입을 권유하지 않으며,
                    금융·의료·법률 자문을 제공하지 않습니다.
                </p>

                <p>
                    중요한 보험 가입 및 보상 판단은 반드시 보험사와 전문가 상담을 통해
                    확인하시기 바랍니다.
                </p>
            </div>
        </div>
    );
}