import StreamView from "@/app/components/StreamView";
type Params = Promise<{ creatorId : string } >
export default async function Creator(props: { params : Params }){
    const params = await props.params;
    const creatorId = params.creatorId
    return (
        <div>
            <StreamView creatorId={creatorId} playVideo={false} />
        </div>
    );
}