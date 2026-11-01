import type {ImgHTMLAttributes} from 'react';
import {imageUrl} from '../lib/catalog';
export default function Photo({name,...props}:ImgHTMLAttributes<HTMLImageElement>&{name:string}){return <img {...props} src={imageUrl(name)}/>;}
