export const Button = ({onClick , children}) => {
  return (
    <button className="py-4 px-10 rounded-3xl bg-green-500 hover:bg-green-900" onClick={onClick} > {children} </button>
  )
}  
